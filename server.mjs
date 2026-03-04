import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

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
    } else {
      socket.destroy();
    }
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
  // Internal Fly.io DNS: <machineId>.vm.<appName>.internal:7681
  // Override with TTYD_HOST for local dev (e.g. "localhost" when using `fly proxy`).
  const ttydHost =
    process.env.TTYD_HOST ||
    `${machineId}.vm.${appName}.internal`;
  const ttydUrl = `ws://${ttydHost}:${TTYD_PORT}/ws`;

  console.log(`[terminal] Connecting to ttyd at ${ttydUrl}`);

  const ttydWs = new WebSocket(ttydUrl, ["tty"]);
  let connected = false;

  ttydWs.on("open", () => {
    connected = true;
    console.log(`[terminal] Connected to ttyd for ${appName}/${machineId}`);
  });

  ttydWs.on("message", (data) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;

    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const msgType = buf[0];

    if (msgType === 0) {
      // OUTPUT — forward terminal data to browser
      clientWs.send(buf.slice(1).toString("utf-8"));
    }
    // Type 1 (set window title) and 2 (set preferences) are ignored
  });

  clientWs.on("message", (msg) => {
    if (ttydWs.readyState !== WebSocket.OPEN) return;

    const str = msg.toString();

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
        const buf = Buffer.alloc(1 + Buffer.byteLength(resizeJson));
        buf[0] = 1; // MSG_RESIZE_TERMINAL
        buf.write(resizeJson, 1);
        ttydWs.send(buf);
        return;
      }
    } catch {
      // Not JSON — treat as terminal input
    }

    // Regular terminal input
    const buf = Buffer.alloc(1 + Buffer.byteLength(str));
    buf[0] = 0; // MSG_INPUT
    buf.write(str, 1);
    ttydWs.send(buf);
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
