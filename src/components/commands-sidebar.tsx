"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Machine } from "@/lib/supabase/machines";

interface Command {
  label: string;
  command: string;
  icon: string;
  group: "openclaw" | "gateway" | "skills" | "machine";
}

interface Skill {
  label: string;
  slug: string;
  icon: string;
}

const GROUPS: { key: Command["group"]; label: string }[] = [
  { key: "openclaw", label: "OpenClaw" },
  { key: "gateway", label: "Gateway" },
  { key: "skills", label: "Skill Management" },
  { key: "machine", label: "Machine" },
];

const commands: Command[] = [
  // OpenClaw
  { label: "Install OpenClaw", command: "curl -fsSL https://openclaw.ai/install.sh | bash", icon: "🐾", group: "openclaw" },
  { label: "Update OpenClaw", command: "openclaw update", icon: "⬆️", group: "openclaw" },
  { label: "OpenClaw Status", command: "openclaw status --all", icon: "📡", group: "openclaw" },
  { label: "OpenClaw Doctor", command: "openclaw doctor", icon: "🩺", group: "openclaw" },
  { label: "View Logs", command: "openclaw logs --follow --limit 50", icon: "📋", group: "openclaw" },
  // Gateway
  { label: "Gateway Status", command: "openclaw gateway status", icon: "🟢", group: "gateway" },
  { label: "Run Gateway", command: "openclaw gateway run", icon: "▶️", group: "gateway" },
  { label: "Stop Gateway", command: "openclaw gateway stop", icon: "⏹️", group: "gateway" },
  { label: "Restart Gateway", command: "openclaw gateway restart", icon: "🔁", group: "gateway" },
  { label: "Gateway Health", command: "openclaw health --verbose", icon: "💓", group: "gateway" },
  { label: "List Channels", command: "openclaw channels list", icon: "💬", group: "gateway" },
  { label: "Channel Status", command: "openclaw channels status --probe", icon: "📶", group: "gateway" },
  { label: "Active Sessions", command: "openclaw sessions --active 60", icon: "👥", group: "gateway" },
  // Skill Management
  { label: "List Skills", command: "openclaw skills list", icon: "📂", group: "skills" },
  { label: "Check Skill Health", command: "openclaw skills check", icon: "✅", group: "skills" },
  // Machine
  { label: "Check Disk Space", command: "df -h /", icon: "💾", group: "machine" },
  { label: "System Resources", command: "free -h && echo \"---\" && uptime", icon: "📊", group: "machine" },
  { label: "Running Processes", command: "ps aux --sort=-%mem | head -20", icon: "⚙️", group: "machine" },
];

const skills: Skill[] = [
  { label: "Add Social Media Image Skill", slug: "generate-social-media-image", icon: "🖼️" },
  { label: "Add Check Email Skill", slug: "check-email", icon: "📧" },
  { label: "Add Web Search Skill", slug: "web-search", icon: "🔍" },
  { label: "Add GitHub PR Automation", slug: "auto-pr-merger", icon: "🔀" },
  { label: "Add Browser Automation", slug: "agent-browser", icon: "🌐" },
  { label: "Add Scheduled Jobs Skill", slug: "cron-scheduler", icon: "⏰" },
  { label: "Add Memory & RAG Skill", slug: "agent-memory", icon: "🧠" },
  { label: "Add DevOps Monitor Skill", slug: "agentic-devops", icon: "🛠️" },
];

export function CommandsSidebar({ machines }: { machines: Machine[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const machineId = searchParams.get("machine") || machines[0]?.id || "";

  const [restarting, setRestarting] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);

  function runCommand(cmd: Command) {
    window.dispatchEvent(
      new CustomEvent("terminal-send-command", { detail: cmd.command })
    );
  }

  async function handleInstallSkill(skill: Skill) {
    if (installingSkill) return;
    setInstallingSkill(skill.slug);
    try {
      const res = await fetch("/api/install-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: skill.slug, machineId }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Failed to install skill: ${data.error}`);
      }
    } catch (err) {
      alert(`Failed to install skill: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInstallingSkill(null);
    }
  }

  async function handleDestroy() {
    if (destroying) return;
    if (!confirm("Destroy this machine? This will permanently delete the machine and its droplet. This cannot be undone.")) return;

    setDestroying(true);
    try {
      const res = await fetch("/api/machines/destroy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`Destroy failed: ${data.error}`);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      alert(`Destroy failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDestroying(false);
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
        body: JSON.stringify({ machineId }),
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
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="p-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Shortcuts
      </div>

      {GROUPS.map((group) => (
        <div key={group.key}>
          <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
            {group.label}
          </div>
          <div className="flex flex-col gap-1 px-3">
            {commands
              .filter((c) => c.group === group.key)
              .map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={() => runCommand(cmd)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <span className="w-5 text-center text-xs">{cmd.icon}</span>
                  <span>{cmd.label}</span>
                </button>
              ))}
          </div>
        </div>
      ))}

      <div className="px-4 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Danger Zone
      </div>
      <div className="flex flex-col gap-1 px-3">
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
        <button
          onClick={handleDestroy}
          disabled={destroying}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <span className="w-5 text-center text-xs">💥</span>
          <span>{destroying ? "Destroying\u2026" : "Destroy Machine"}</span>
          {destroying && (
            <span className="ml-auto text-xs text-red-400 animate-pulse">...</span>
          )}
        </button>
      </div>

      <div className="px-4 pt-4 pb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Skills
      </div>
      <div className="flex flex-col gap-1 px-3 pb-4">
        {skills.map((skill) => (
          <button
            key={skill.slug}
            onClick={() => handleInstallSkill(skill)}
            disabled={installingSkill === skill.slug}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="w-5 text-center text-xs">{skill.icon}</span>
            <span>
              {installingSkill === skill.slug ? "Installing\u2026" : skill.label}
            </span>
            {installingSkill === skill.slug && (
              <span className="ml-auto text-xs text-zinc-400 animate-pulse">...</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
