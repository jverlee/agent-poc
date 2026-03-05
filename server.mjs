import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { parse } from "node:url";
import { resolve } from "node:path";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { Client } from "ssh2";

// Load .env.local if it exists (for local dev overrides)
try {
  const envFile = readFileSync(".env.local", "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env.local — that's fine
}

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// People data — must stay in sync with src/lib/people.ts
const people = [
  { name: "Sam", ip: "137.184.72.180", enabled: true },
  { name: "Kelly", ip: null, enabled: false },
  { name: "Greg", ip: null, enabled: false },
  { name: "Alex", ip: null, enabled: false },
];

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname, query } = parse(req.url, true);

    if (pathname === "/api/terminal") {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        handleTerminalConnection(clientWs, query);
      });
    }
    // Non-terminal upgrades (e.g. Next.js HMR) are left unhandled
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});

function getSSHConfig(ip) {
  const keyPath = process.env.SSH_PRIVATE_KEY_PATH || "~/.ssh/id_rsa";
  const resolved = keyPath.startsWith("~")
    ? keyPath.replace("~", process.env.HOME || "/root")
    : resolve(keyPath);

  return {
    host: ip,
    port: 22,
    username: process.env.SSH_USER || "root",
    privateKey: readFileSync(resolved),
  };
}

/**
 * Proxies a browser WebSocket to an SSH shell on a Digital Ocean droplet.
 *
 * Protocol:
 *   Browser sends raw text (keystrokes)      → SSH stdin
 *   Browser sends JSON {cols, rows}          → SSH channel.setWindow()
 *   SSH stdout                               → browser (text)
 */
const MAX_SSH_RETRIES = 3;
const SSH_RETRY_DELAY_MS = 2000;

function handleTerminalConnection(clientWs, query) {
  const { personIndex } = query;

  if (personIndex === undefined) {
    clientWs.send("\x1b[1;31mMissing personIndex\x1b[0m\r\n");
    clientWs.close();
    return;
  }

  // Look up the person's IP
  let ip;
  if (people) {
    const person = people[parseInt(personIndex, 10)];
    if (!person || !person.enabled || !person.ip) {
      clientWs.send("\x1b[1;31mAgent not available\x1b[0m\r\n");
      clientWs.close();
      return;
    }
    ip = person.ip;
  } else {
    clientWs.send("\x1b[1;31mPeople data not loaded\x1b[0m\r\n");
    clientWs.close();
    return;
  }

  let sshConn = null;
  let sshStream = null;
  let attempt = 0;
  const pendingMessages = [];

  function connectSSH() {
    attempt++;
    console.log(`[terminal] SSH connecting to ${ip} (attempt ${attempt}/${MAX_SSH_RETRIES})`);

    sshConn = new Client();

    sshConn.on("ready", () => {
      console.log(`[terminal] SSH connected to ${ip}`);
      sshConn.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) {
          console.error(`[terminal] SSH shell error: ${err.message}`);
          clientWs.send(`\r\n\x1b[1;31mFailed to open shell: ${err.message}\x1b[0m\r\n`);
          clientWs.close();
          return;
        }

        sshStream = stream;

        // SSH stdout → browser
        stream.on("data", (data) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data.toString("utf-8"));
          }
        });

        stream.stderr.on("data", (data) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data.toString("utf-8"));
          }
        });

        stream.on("close", () => {
          console.log(`[terminal] SSH stream closed for ${ip}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send("\r\n\x1b[1;31mTerminal session ended\x1b[0m\r\n");
            clientWs.close();
          }
          sshConn.end();
        });

        // Flush queued messages
        while (pendingMessages.length > 0) {
          forwardToSSH(pendingMessages.shift());
        }
      });
    });

    sshConn.on("error", (err) => {
      console.error(`[terminal] SSH connection error (attempt ${attempt}): ${err.message}`);
      if (attempt < MAX_SSH_RETRIES && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          `\r\n\x1b[1;33mConnection attempt ${attempt} failed, retrying in ${SSH_RETRY_DELAY_MS / 1000}s...\x1b[0m\r\n`
        );
        sshConn.removeAllListeners();
        setTimeout(connectSSH, SSH_RETRY_DELAY_MS);
      } else if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          `\r\n\x1b[1;31mFailed to connect after ${MAX_SSH_RETRIES} attempts: ${err.message}\x1b[0m\r\n`
        );
        clientWs.close();
      }
    });

    sshConn.on("close", () => {
      console.log(`[terminal] SSH connection closed for ${ip}`);
    });

    sshConn.connect(getSSHConfig(ip));
  }

  function forwardToSSH(str) {
    if (!sshStream) return;

    // Check if this is a resize message (JSON with cols/rows)
    try {
      const parsed = JSON.parse(str);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "cols" in parsed &&
        "rows" in parsed
      ) {
        sshStream.setWindow(parsed.rows, parsed.cols, 0, 0);
        return;
      }
    } catch {
      // Not JSON — treat as terminal input
    }

    sshStream.write(str);
  }

  clientWs.on("message", (msg) => {
    const str = msg.toString();

    if (sshStream) {
      forwardToSSH(str);
    } else {
      pendingMessages.push(str);
    }
  });

  clientWs.on("close", () => {
    console.log(`[terminal] Client disconnected for ${ip}`);
    if (sshStream) sshStream.close();
    if (sshConn) sshConn.end();
  });

  connectSSH();
}
