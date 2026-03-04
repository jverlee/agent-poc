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

    // Connect through the server-side WebSocket proxy which handles
    // ttyd binary protocol translation and Fly machine targeting
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal?appName=${encodeURIComponent(appName)}&machineId=${encodeURIComponent(machineId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln("\x1b[1;32mConnected\x1b[0m");
      // Send initial terminal size as JSON (proxy translates to ttyd protocol)
      ws.send(JSON.stringify({ cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      // Proxy strips ttyd framing and forwards plain text output
      term.write(event.data);
    };

    ws.onclose = () => {
      term.writeln("\r\n\x1b[1;31mDisconnected\x1b[0m");
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[1;31mWebSocket error\x1b[0m");
    };

    // Forward user input as plain text (proxy translates to ttyd protocol)
    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle terminal resize — send JSON (proxy translates to ttyd protocol)
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ cols, rows }));
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
