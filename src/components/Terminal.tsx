"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export interface TerminalHandle {
  sendCommand: (command: string) => void;
}

interface TerminalProps {
  machineId: string;
  machineName: string;
  isActive?: boolean;
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { machineId, machineName, isActive = true },
  ref
) {
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
      lineHeight: 1.5,
      scrollback: 5000,
      theme: {
        background: "#18181b",
        foreground: "#d4d4d8",
        cursor: "#a1a1aa",
        selectionBackground: "#3f3f4680",
        black: "#27272a",
        brightBlack: "#52525b",
        white: "#e4e4e7",
        brightWhite: "#fafafa",
        blue: "#60a5fa",
        brightBlue: "#93c5fd",
        cyan: "#67e8f9",
        brightCyan: "#a5f3fc",
        green: "#4ade80",
        brightGreen: "#86efac",
        red: "#f87171",
        brightRed: "#fca5a5",
        yellow: "#fbbf24",
        brightYellow: "#fde68a",
        magenta: "#c084fc",
        brightMagenta: "#d8b4fe",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;
    wsRef.current = null; // reset before new connection

    term.writeln(
      `\x1b[1;36mConnecting to ${machineName}...\x1b[0m`
    );

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal?machineId=${machineId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln("\x1b[1;32mConnected\x1b[0m");
      ws.send(JSON.stringify({ cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      term.writeln("\r\n\x1b[1;31mDisconnected\x1b[0m");
    };

    ws.onerror = () => {
      term.writeln("\r\n\x1b[1;31mWebSocket error\x1b[0m");
    };

    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

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
  }, [machineId, machineName]);

  useImperativeHandle(ref, () => ({
    sendCommand: (command: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && command) {
        wsRef.current.send(command + "\r");
      }
    },
  }));

  useEffect(() => {
    if (isActive && fitRef.current) {
      fitRef.current.fit();
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#18181b] p-3 rounded-md"
    />
  );
});

export default Terminal;
