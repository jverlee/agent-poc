"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Machine } from "@/lib/supabase/machines";

const TabbedTerminal = dynamic(() => import("@/components/TabbedTerminal"), {
  ssr: false,
});

function TerminalPanelInner({ machines }: { machines: Machine[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const searchParams = useSearchParams();
  const machineId = searchParams.get("machine") || machines[0]?.id;
  const enabledMachines = machines.filter((m) => m.enabled);

  return (
    <aside
      className={`relative flex shrink-0 border-r border-zinc-200 bg-zinc-50 transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${collapsed ? "w-0 overflow-hidden" : "w-[40rem]"}`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs text-zinc-500 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        title={collapsed ? "Expand terminal" : "Collapse terminal"}
      >
        {collapsed ? "\u203A" : "\u2039"}
      </button>
      {!collapsed && (
        <div className="flex h-full w-[40rem] flex-col">
          <div className="shrink-0 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              SSH Terminal
            </h2>
          </div>
          <div className="min-h-0 flex-1">
            {enabledMachines.map((m) => (
              <div
                key={m.id}
                className="h-full w-full"
                style={{
                  display: m.id === machineId ? "block" : "none",
                }}
              >
                <TabbedTerminal
                  machineId={m.id}
                  machineName={m.name}
                  isActive={m.id === machineId}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export function TerminalPanel({ machines }: { machines: Machine[] }) {
  return (
    <Suspense>
      <TerminalPanelInner machines={machines} />
    </Suspense>
  );
}
