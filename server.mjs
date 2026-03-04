import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

// Load .env.local if it exists (for local dev overrides like TTYD_HOST)
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

const TTYD_PORT = process.env.TTYD_PORT || "7681";

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
    // so the default server behavior can process them
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});

/**
 * Proxies a browser WebSocket to a ttyd instance on a Fly machine.
 *
 * Protocol translation:
 *   Browser sends raw text (keystrokes)      → proxy prepends 0x00 (INPUT)  → ttyd
 *   Browser sends JSON {cols, rows}          → proxy prepends 0x01 (RESIZE) → ttyd
 *   ttyd sends 0x00 + output bytes           → proxy strips prefix          → browser
 */
function handleTerminalConnection(clientWs, query) {
  const { appName, machineId } = query;

  if (!appName || !machineId) {
    clientWs.send("\x1b[1;31mMissing appName or machineId\x1b[0m\r\n");
    clientWs.close();
    return;
  }

  // Build ttyd WebSocket URL.
  // In production (on Fly): use internal DNS <machineId>.vm.<appName>.internal:7681
  // Locally: use Fly's public proxy wss://<appName>.fly.dev/ws
  const isLocal = dev || process.env.TTYD_USE_PUBLIC_PROXY === "true";
  let ttydUrl;
  let wsOptions = { protocols: ["tty"] };

  if (isLocal) {
    ttydUrl = `wss://${appName}.fly.dev/ws`;
    wsOptions.headers = { "fly-force-instance-id": machineId };
  } else {
    const ttydHost = `${machineId}.vm.${appName}.internal`;
    ttydUrl = `ws://${ttydHost}:${TTYD_PORT}/ws`;
  }

  console.log(`[terminal] Connecting to ttyd at ${ttydUrl}`);

  const ttydWs = new WebSocket(ttydUrl, wsOptions.protocols, {
    headers: wsOptions.headers,
  });
  let connected = false;

  ttydWs.on("open", () => {
    connected = true;
    console.log(`[terminal] Connected to ttyd for ${appName}/${machineId}`);
    // ttyd requires an auth handshake before spawning the shell.
    // The JSON_DATA message type in ttyd's protocol is '{' (0x7B),
    // so sending raw JSON works — the opening brace IS the type indicator.
    ttydWs.send('{"AuthToken":""}');
  });

  ttydWs.on("message", (data) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;

    // ttyd sends binary frames: first byte is message type, rest is payload.
    // Via Fly's HTTPS proxy, binary frames may arrive as text frames where
    // the first character is the ASCII digit of the message type.
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    let msgType = buf[0];

    // Normalize: if we got ASCII '0' (48), '1' (49), '2' (50), convert to 0/1/2
    if (msgType >= 48 && msgType <= 50) {
      msgType = msgType - 48;
    }

    console.log(`[terminal] ttyd→browser: type=${msgType} len=${buf.length} raw0=${buf[0]} preview=${buf.slice(0, 20).toString("hex")}`);

    if (msgType === 0) {
      // OUTPUT — forward terminal data to browser
      clientWs.send(buf.slice(1).toString("utf-8"));
    }
    // Type 1 (set window title) and 2 (set preferences) are ignored
  });

  clientWs.on("message", (msg) => {
    if (ttydWs.readyState !== WebSocket.OPEN) return;

    const str = msg.toString();
    console.log(`[terminal] browser→ttyd: ${JSON.stringify(str).slice(0, 100)}`);

    // Check if this is a resize message (JSON with cols/rows)
    try {
      const parsed = JSON.parse(str);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "cols" in parsed &&
        "rows" in parsed
      ) {
        const resizeJson = JSON.stringify({
          columns: parsed.cols,
          rows: parsed.rows,
        });
        if (isLocal) {
          // Text frame: '1' + JSON
          ttydWs.send("1" + resizeJson);
        } else {
          const buf = Buffer.alloc(1 + Buffer.byteLength(resizeJson));
          buf[0] = 1; // MSG_RESIZE_TERMINAL
          buf.write(resizeJson, 1);
          ttydWs.send(buf);
        }
        return;
      }
    } catch {
      // Not JSON — treat as terminal input
    }

    // Regular terminal input
    if (isLocal) {
      // Text frame: '0' + input
      ttydWs.send("0" + str);
    } else {
      const buf = Buffer.alloc(1 + Buffer.byteLength(str));
      buf[0] = 0; // MSG_INPUT
      buf.write(str, 1);
      ttydWs.send(buf);
    }
  });

  clientWs.on("close", () => {
    console.log(`[terminal] Client disconnected (${appName}/${machineId})`);
    if (ttydWs.readyState === WebSocket.OPEN) ttydWs.close();
  });

  ttydWs.on("close", () => {
    console.log(`[terminal] ttyd disconnected (${appName}/${machineId})`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send("\r\n\x1b[1;31mTerminal session ended\x1b[0m\r\n");
      clientWs.close();
    }
  });

  ttydWs.on("error", (err) => {
    console.error(`[terminal] ttyd connection error: ${err.message}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        `\r\n\x1b[1;31mFailed to connect to terminal: ${err.message}\x1b[0m\r\n`
      );
      clientWs.close();
    }
  });
}
