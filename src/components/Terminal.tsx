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
  sessionName?: string;
  autoCommand?: string;
  onAuthUrl?: (url: string | null) => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

const AUTH_URL_PATTERN = /https:\/\/claude\.ai\/oauth\/authorize[^\s\x1b]*/;

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { machineId, machineName, isActive = true, sessionName, autoCommand, onAuthUrl },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const unmountedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authBufferRef = useRef("");

  useEffect(() => {
    unmountedRef.current = false;
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

    function buildWsUrl() {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let url = `${wsProtocol}//${window.location.host}/api/terminal?machineId=${machineId}`;
      if (sessionName) url += `&sessionName=${encodeURIComponent(sessionName)}`;
      if (autoCommand) url += `&autoCommand=${encodeURIComponent(autoCommand)}`;
      return url;
    }

    function connect() {
      if (unmountedRef.current) return;

      const isReconnect = reconnectAttemptRef.current > 0;
      if (!isReconnect) {
        term.writeln(`\x1b[1;36mConnecting to ${machineName}...\x1b[0m`);
      }

      const ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        if (isReconnect) {
          term.writeln("\x1b[1;32mReconnected\x1b[0m");
        } else {
          term.writeln("\x1b[1;32mConnected\x1b[0m");
        }
        ws.send(JSON.stringify({ cols: term.cols, rows: term.rows }));
      };

      ws.onmessage = (event) => {
        term.write(event.data);
        if (onAuthUrl) {
          const text = typeof event.data === "string" ? event.data : "";
          authBufferRef.current += text;
          // Keep buffer from growing unbounded (last 4KB is plenty)
          if (authBufferRef.current.length > 4096) {
            authBufferRef.current = authBufferRef.current.slice(-4096);
          }
          const clean = stripAnsi(authBufferRef.current);
          const match = clean.match(AUTH_URL_PATTERN);
          if (match) {
            onAuthUrl(match[0]);
            // Clear buffer so we don't re-match endlessly
            authBufferRef.current = "";
          }
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;

        if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptRef.current++;
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current - 1),
            MAX_RECONNECT_DELAY
          );
          term.writeln(
            `\r\n\x1b[1;33mDisconnected. Reconnecting in ${Math.round(delay / 1000)}s... (${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})\x1b[0m`
          );
          reconnectTimerRef.current = setTimeout(connect, delay);
        } else {
          term.writeln("\r\n\x1b[1;31mConnection lost. Reload the page to retry.\x1b[0m");
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };
    }

    const dataDisposable = term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ cols, rows }));
      }
    });

    const onWindowResize = () => {
      fit.fit();
    };
    window.addEventListener("resize", onWindowResize);

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      window.removeEventListener("resize", onWindowResize);
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (wsRef.current) wsRef.current.close();
      term.dispose();
    };
  }, [machineId, machineName, sessionName, autoCommand]);

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
