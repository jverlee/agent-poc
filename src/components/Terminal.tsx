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
  const lineRef = useRef("");
  const busyRef = useRef(false);

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

    term.writeln(`\x1b[1;36mConnected to ${appName} / ${machineId}\x1b[0m`);
    term.writeln(
      "\x1b[90mEach command runs in a fresh context. Use sh -c 'cmd1 && cmd2' to chain commands.\x1b[0m"
    );
    term.writeln("");
    writePrompt(term);

    term.onKey(({ key, domEvent }) => {
      if (busyRef.current) return;

      if (domEvent.key === "Enter") {
        term.write("\r\n");
        const cmd = lineRef.current.trim();
        lineRef.current = "";
        if (cmd) {
          execCommand(term, cmd);
        } else {
          writePrompt(term);
        }
      } else if (domEvent.key === "Backspace") {
        if (lineRef.current.length > 0) {
          lineRef.current = lineRef.current.slice(0, -1);
          term.write("\b \b");
        }
      } else if (
        key.length === 1 &&
        !domEvent.ctrlKey &&
        !domEvent.altKey &&
        !domEvent.metaKey
      ) {
        lineRef.current += key;
        term.write(key);
      }
    });

    const onResize = () => fit.fit();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appName, machineId]);

  function writePrompt(term: XTerm) {
    term.write("\x1b[1;32m$ \x1b[0m");
  }

  async function execCommand(term: XTerm, command: string) {
    busyRef.current = true;
    try {
      const res = await fetch("/api/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, machineId, command }),
      });
      const data = await res.json();

      if (data.error) {
        term.writeln(`\x1b[1;31m${data.error}\x1b[0m`);
      } else {
        if (data.stdout) {
          term.write(data.stdout.replace(/\n/g, "\r\n"));
          if (!data.stdout.endsWith("\n")) term.write("\r\n");
        }
        if (data.stderr) {
          term.write(`\x1b[31m${data.stderr.replace(/\n/g, "\r\n")}\x1b[0m`);
          if (!data.stderr.endsWith("\n")) term.write("\r\n");
        }
        if (data.exit_code !== 0 && data.exit_code !== undefined) {
          term.writeln(`\x1b[90m[exit code: ${data.exit_code}]\x1b[0m`);
        }
      }
    } catch (err) {
      term.writeln(
        `\x1b[1;31mError: ${err instanceof Error ? err.message : String(err)}\x1b[0m`
      );
    }
    writePrompt(term);
    busyRef.current = false;
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg border border-zinc-800 bg-[#18181b] p-2"
    />
  );
}
