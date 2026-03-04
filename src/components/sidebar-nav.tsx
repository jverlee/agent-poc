"use client";

import { useSearchParams } from "next/navigation";
import { people } from "@/lib/people";

export function SidebarNav() {
  const searchParams = useSearchParams();
  const currentApp = searchParams.get("app");
  const currentMachine = searchParams.get("machine");

  return (
    <ul className="flex flex-col gap-1 px-3">
      {people.map((person) => {
        const isActive =
          person.appName === currentApp && person.machineId === currentMachine ||
          (!currentApp && !currentMachine && person === people[0]);

        return (
          <li key={person.name}>
            <a
              href={`/?app=${person.appName}&machine=${person.machineId}`}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <img src={person.avatar} alt={person.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
              <div className="flex flex-col">
                <span>{person.name}</span>
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-500">{person.role}</span>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
