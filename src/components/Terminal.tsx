"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface TerminalHandle {
  sendCommand: (command: string) => void;
  typeText: (text: string) => void;
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

// hterm theme colors matching the zinc dark theme
const HTERM_COLORS = [
  "#27272a", // 0: black
  "#f87171", // 1: red
  "#4ade80", // 2: green
  "#fbbf24", // 3: yellow
  "#60a5fa", // 4: blue
  "#c084fc", // 5: magenta
  "#67e8f9", // 6: cyan
  "#e4e4e7", // 7: white
  "#52525b", // 8: bright black
  "#fca5a5", // 9: bright red
  "#86efac", // 10: bright green
  "#fde68a", // 11: bright yellow
  "#93c5fd", // 12: bright blue
  "#d8b4fe", // 13: bright magenta
  "#a5f3fc", // 14: bright cyan
  "#fafafa", // 15: bright white
];

const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { machineId, machineName, isActive = true, sessionName, autoCommand, onAuthUrl },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const htermRef = useRef<any>(null);
  const ioRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const unmountedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authBufferRef = useRef("");
  const readyRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    if (!containerRef.current) return;

    // Dynamically import hterm (it uses globals and can't be imported at module level in SSR)
    let cancelled = false;

    async function init() {
      // @ts-expect-error hterm-umdjs has no type declarations
      const htermAll = await import("hterm-umdjs");
      if (cancelled) return;

      const { hterm, lib } = htermAll;

      // Wait for lib.init if needed
      await new Promise<void>((resolve) => {
        if (lib.init) {
          lib.init(resolve);
        } else {
          resolve();
        }
      });
      if (cancelled) return;

      // Disable default new window behavior
      hterm.defaultStorage = new lib.Storage.Memory();

      const term = new hterm.Terminal();

      term.onTerminalReady = () => {
        if (cancelled) return;

        // Apply theme/preferences
        const prefs = term.getPrefs();
        prefs.set("background-color", "#18181b");
        prefs.set("foreground-color", "#d4d4d8");
        prefs.set("cursor-color", "rgba(161, 161, 170, 0.5)");
        prefs.set("cursor-blink", true);
        prefs.set("font-family", "Arial, sans-serif");
        prefs.set("font-size", 14);
        prefs.set("color-palette-overrides", HTERM_COLORS);
        prefs.set("enable-bold", true);
        prefs.set("enable-blink", true);
        prefs.set("scroll-on-output", true);
        prefs.set("scroll-on-keystroke", true);
        prefs.set("audible-bell-sound", "");
        prefs.set("receive-encoding", "utf-8");
        prefs.set("send-encoding", "utf-8");
        prefs.set("enable-clipboard-notice", false);
        prefs.set("copy-on-select", false);
        prefs.set("use-default-window-copy", true);
        prefs.set("ctrl-plus-minus-zero-zoom", false);
        prefs.set("ctrl-c-copy", true);
        prefs.set("ctrl-v-paste", true);

        const io = term.io.push();
        ioRef.current = io;

        io.onVTKeystroke = (str: string) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(str);
          }
        };

        io.sendString = (str: string) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(str);
          }
        };

        io.onTerminalResize = (cols: number, rows: number) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ cols, rows }));
          }
        };

        htermRef.current = term;
        readyRef.current = true;

        connect();
      };

      term.decorate(containerRef.current);
      term.installKeyboard();

      // Style the iframe that hterm creates to remove borders and fit
      const iframe = containerRef.current?.querySelector("iframe");
      if (iframe) {
        iframe.style.position = "absolute";
        iframe.style.top = "0";
        iframe.style.left = "0";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
      }
    }

    function buildWsUrl() {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let url = `${wsProtocol}//${window.location.host}/api/terminal?machineId=${machineId}`;
      if (sessionName) url += `&sessionName=${encodeURIComponent(sessionName)}`;
      if (autoCommand) url += `&autoCommand=${encodeURIComponent(autoCommand)}`;
      return url;
    }

    function writeToTerminal(text: string) {
      if (ioRef.current) {
        ioRef.current.print(text);
      }
    }

    function connect() {
      if (unmountedRef.current) return;

      const isReconnect = reconnectAttemptRef.current > 0;
      if (!isReconnect) {
        writeToTerminal(`\x1b[1;36mConnecting to ${machineName}...\x1b[0m\r\n`);
      }

      const ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        if (isReconnect) {
          writeToTerminal("\x1b[1;32mReconnected\x1b[0m\r\n");
        } else {
          writeToTerminal("\x1b[1;32mConnected\x1b[0m\r\n");
        }

        const term = htermRef.current;
        if (term) {
          const cols = term.screenSize?.width || 80;
          const rows = term.screenSize?.height || 24;
          ws.send(JSON.stringify({ cols, rows }));
        }
      };

      ws.onmessage = (event) => {
        writeToTerminal(event.data);

        if (onAuthUrl) {
          const text = typeof event.data === "string" ? event.data : "";
          authBufferRef.current += text;
          if (authBufferRef.current.length > 4096) {
            authBufferRef.current = authBufferRef.current.slice(-4096);
          }
          const clean = stripAnsi(authBufferRef.current);
          const match = clean.match(AUTH_URL_PATTERN);
          if (match) {
            onAuthUrl(match[0]);
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
          writeToTerminal(
            `\r\n\x1b[1;33mDisconnected. Reconnecting in ${Math.round(delay / 1000)}s... (${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})\x1b[0m\r\n`
          );
          reconnectTimerRef.current = setTimeout(connect, delay);
        } else {
          writeToTerminal("\r\n\x1b[1;31mConnection lost. Reload the page to retry.\x1b[0m\r\n");
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };
    }

    init();

    return () => {
      cancelled = true;
      unmountedRef.current = true;
      readyRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
      if (htermRef.current) {
        try {
          htermRef.current.uninstallKeyboard();
        } catch {
          // ignore
        }
      }
      htermRef.current = null;
      ioRef.current = null;
    };
  }, [machineId, machineName, sessionName, autoCommand]);

  useImperativeHandle(ref, () => ({
    sendCommand: (command: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && command) {
        wsRef.current.send(command + "\r");
      }
    },
    typeText: (text: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && text) {
        wsRef.current.send(text);
      }
    },
  }));

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-[#18181b] rounded-md"
      style={{ position: "relative", overflow: "hidden" }}
    />
  );
});

export default Terminal;
