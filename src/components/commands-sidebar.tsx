"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

interface Command {
  label: string;
  command: string;
  icon: string;
}

interface Skill {
  label: string;
  slug: string;
  icon: string;
}

const commands: Command[] = [
  { label: "Install OpenClaw", command: "curl -fsSL https://openclaw.ai/install.sh | bash", icon: "🐾" },
];

const skills: Skill[] = [
  { label: "Add Social Media Image Skill", slug: "generate-social-media-image", icon: "🖼️" },
  { label: "Add Check Email Skill", slug: "check-email", icon: "📧" },
];

export function CommandsSidebar() {
  const searchParams = useSearchParams();
  const personIndex = parseInt(searchParams.get("person") || "0", 10);

  const [restarting, setRestarting] = useState(false);
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
        body: JSON.stringify({ skill: skill.slug, personIndex }),
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

  async function handleRestart() {
    if (restarting) return;
    if (!confirm("Force restart this machine? This will interrupt any running processes.")) return;

    setRestarting(true);
    try {
      const res = await fetch("/api/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIndex }),
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
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="w-5 text-center text-xs">{cmd.icon}</span>
            <span>{cmd.label}</span>
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

      <div className="px-4 pt-4 pb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Skills
      </div>
      <div className="flex flex-col gap-1 px-3">
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
