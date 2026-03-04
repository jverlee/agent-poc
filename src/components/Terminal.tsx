"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  appName: string;
  machineId: string;
}

export default function Terminal({ appName, machineId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "var(--font-geist-mono), monospace",
      fontSize: 14,
      scrollback: 5000,
      theme: {
        background: "#18181b",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#3f3f46",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    term.writeln(
      `\x1b[1;36mConnecting to ${appName} / ${machineId}...\x1b[0m`
    );

    // Connect directly to ttyd on the Fly machine
    const wsUrl = `wss://${appName}.fly.dev/ws`;
    const ws = new WebSocket(wsUrl, ["tty"]);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln("\x1b[1;32mConnected\x1b[0m");
      // Send initial terminal size (ttyd binary protocol: type 1 = resize)
      const resizeJson = JSON.stringify({
        columns: term.cols,
        rows: term.rows,
      });
      const resizeBuf = new Uint8Array(1 + resizeJson.length);
      resizeBuf[0] = 1; // MSG_RESIZE_TERMINAL
      for (let i = 0; i < resizeJson.length; i++) {
        resizeBuf[i + 1] = resizeJson.charCodeAt(i);
      }
      ws.send(resizeBuf.buffer);
    };

    ws.onmessage = (event) => {
      // ttyd binary protocol: first byte is message type
      const buf = new Uint8Array(event.data);
      const msgType = buf[0];

      if (msgType === 0) {
        // OUTPUT — terminal data
        const text = new TextDecoder().decode(buf.slice(1));
        term.write(text);
      }
      // Type 1 (set window title) and 2 (set preferences) are ignored
    };

    ws.onclose = () => {
      term.writeln("\r\n\x1b[1;31mDisconnected\x1b[0m");
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[1;31mWebSocket error\x1b[0m");
    };

    // Forward user input to WebSocket (ttyd binary protocol: type 0 = input)
    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        const encoded = new TextEncoder().encode(data);
        const inputBuf = new Uint8Array(1 + encoded.length);
        inputBuf[0] = 0; // MSG_INPUT
        inputBuf.set(encoded, 1);
        ws.send(inputBuf.buffer);
      }
    });

    // Handle terminal resize
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        const resizeJson = JSON.stringify({ columns: cols, rows });
        const resizeBuf = new Uint8Array(1 + resizeJson.length);
        resizeBuf[0] = 1; // MSG_RESIZE_TERMINAL
        for (let i = 0; i < resizeJson.length; i++) {
          resizeBuf[i + 1] = resizeJson.charCodeAt(i);
        }
        ws.send(resizeBuf.buffer);
      }
    });

    // Re-fit on window resize
    const onWindowResize = () => {
      fit.fit();
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      dataDisposable.dispose();
      resizeDisposable.dispose();
      ws.close();
      term.dispose();
    };
  }, [appName, machineId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg border border-zinc-800 bg-[#18181b] p-2"
    />
  );
}
