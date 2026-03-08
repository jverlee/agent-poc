"use client";

import { useState, Suspense } from "react";
import { CommandsSidebar } from "./commands-sidebar";
import type { Machine } from "@/lib/supabase/machines";

export function RightSidebar({ machines }: { machines: Machine[] }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside className="relative flex shrink-0 border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-300 bg-white text-xs text-zinc-500 shadow-sm hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
        title={collapsed ? "Expand shortcuts" : "Collapse shortcuts"}
      >
        {collapsed ? "\u2039" : "\u203A"}
      </button>
      <div
        className={`h-full overflow-hidden transition-all duration-200 ${collapsed ? "w-0" : "w-56"}`}
      >
        <div className="h-full w-56 overflow-y-auto">
          <Suspense>
            <CommandsSidebar machines={machines} />
          </Suspense>
        </div>
      </div>
    </aside>
  );
}
