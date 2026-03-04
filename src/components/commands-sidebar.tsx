"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

interface Command {
  label: string;
  command: string;
  icon: string;
}

const commands: Command[] = [
  { label: "Disk Usage", command: "df -h", icon: "💾" },
  { label: "Memory", command: "free -h", icon: "🧠" },
  { label: "Top Processes", command: "ps aux --sort=-%cpu | head -10", icon: "📊" },
  { label: "Uptime", command: "uptime", icon: "⏱" },
  { label: "Network Info", command: "ip addr show", icon: "🌐" },
  { label: "Tail Logs", command: "tail -n 20 /var/log/syslog", icon: "📋" },
  { label: "Who's Logged In", command: "who", icon: "👤" },
  { label: "CPU Info", command: "lscpu | head -15", icon: "⚡" },
];

export function CommandsSidebar() {
  const searchParams = useSearchParams();
  const appName = searchParams.get("app") || "agent-a";
  const machineId = searchParams.get("machine") || "185924c433dd78";

  const [running, setRunning] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [result, setResult] = useState<{ stdout: string; stderr: string } | null>(null);

  async function runCommand(cmd: Command) {
    setRunning(cmd.label);
    setResult(null);
    try {
      const res = await fetch("/api/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, machineId, command: cmd.command }),
      });
      const data = await res.json();
      if (data.error) {
        setResult({ stdout: "", stderr: data.error });
      } else {
        setResult({
          stdout: data.stdout ? atob(data.stdout) : "",
          stderr: data.stderr ? atob(data.stderr) : "",
        });
      }
    } catch (err) {
      setResult({ stdout: "", stderr: String(err) });
    } finally {
      setRunning(null);
    }
  }

  async function handleRestart() {
    if (restarting) return;
    if (!confirm("Force restart this machine? This will interrupt any running processes.")) return;

    setRestarting(true);
    try {
      const res = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, machineId }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Restart failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Restart failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Shortcuts
      </div>
      <div className="flex flex-col gap-1 px-3">
        {commands.map((cmd) => (
          <button
            key={cmd.label}
            onClick={() => runCommand(cmd)}
            disabled={running !== null}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="w-5 text-center text-xs">{cmd.icon}</span>
            <span>{cmd.label}</span>
            {running === cmd.label && (
              <span className="ml-auto text-xs text-zinc-400 animate-pulse">...</span>
            )}
          </button>
        ))}
        <button
          onClick={handleRestart}
          disabled={restarting}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <span className="w-5 text-center text-xs">🔄</span>
          <span>{restarting ? "Restarting\u2026" : "Force Restart"}</span>
          {restarting && (
            <span className="ml-auto text-xs text-zinc-400 animate-pulse">...</span>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-3 flex-1 overflow-auto border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs font-medium text-zinc-500 mb-1">Output</div>
          <pre className="whitespace-pre-wrap break-all rounded bg-zinc-100 p-2 text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            {result.stdout || result.stderr || "(no output)"}
          </pre>
          {result.stdout && result.stderr && (
            <>
              <div className="text-xs font-medium text-red-500 mt-2 mb-1">Stderr</div>
              <pre className="whitespace-pre-wrap break-all rounded bg-red-50 p-2 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-300">
                {result.stderr}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
