"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { useStatuses } from "@/components/status-provider";
import type { Machine } from "@/lib/supabase/machines";

interface SidebarNavProps {
  machines: Machine[];
  onAddMachine?: () => void;
}

export function SidebarNav({ machines, onAddMachine }: SidebarNavProps) {
  const searchParams = useSearchParams();
  const currentMachineId = searchParams.get("machine") || machines[0]?.id;
  const { statuses } = useStatuses();

  return (
    <div className="flex flex-col gap-1 px-3">
      <ul className="flex flex-col gap-1">
        {machines.map((machine) => {
          const isActive = machine.id === currentMachineId;
          const isDisabled = !machine.enabled;

          if (isDisabled) {
            return (
              <li key={machine.id}>
                <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium opacity-40 cursor-not-allowed">
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                      {machine.name.charAt(0).toUpperCase()}
                    </div>
                    <StatusBadge state="disabled" size="sm" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-500">{machine.name}</span>
                    {machine.role && (
                      <span className="text-xs font-normal text-zinc-600">{machine.role}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={machine.id}>
              <Link
                href={`/?machine=${machine.id}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-sm font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                    {machine.name.charAt(0).toUpperCase()}
                  </div>
                  <StatusBadge
                    state={statuses[machine.id]}
                    size="sm"
                  />
                </div>
                <div className="flex flex-col">
                  <span>{machine.name}</span>
                  {machine.role && (
                    <span className="text-xs font-normal text-zinc-500 dark:text-zinc-500">{machine.role}</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {onAddMachine && (
        <button
          onClick={onAddMachine}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add machine
        </button>
      )}
    </div>
  );
}
