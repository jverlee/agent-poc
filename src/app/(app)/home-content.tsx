"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConnectionForm from "@/components/ConnectionForm";
import { StatusBadge } from "@/components/status-badge";
import { useStatuses } from "@/components/status-provider";
import type { Machine } from "@/lib/supabase/machines";

function HomeInner({ machines }: { machines: Machine[] }) {
  const searchParams = useSearchParams();
  const machineId = searchParams.get("machine") || machines[0]?.id;

  const machine = machines.find((m) => m.id === machineId);

  const { setMachineStatus } = useStatuses();
  const [machineState, setMachineState] = useState<string | null>(null);
  const [machineSpecs, setMachineSpecs] = useState<{
    cpus: number | null;
    cpuKind: string | null;
    memoryMb: number | null;
  }>({ cpus: null, cpuKind: null, memoryMb: null });

  const fetchStatus = useCallback(async () => {
    if (!machine?.enabled || !machineId) return;
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId }),
      });
      const data = await res.json();
      if (data.state) {
        setMachineState(data.state);
        setMachineStatus(machineId, data.state);
      }
      if (data.cpus != null) {
        setMachineSpecs({
          cpus: data.cpus,
          cpuKind: data.cpuKind,
          memoryMb: data.memoryMb,
        });
      }
    } catch {
      // silently ignore polling errors
    }
  }, [machineId, machine?.enabled, setMachineStatus]);

  useEffect(() => {
    setMachineState(null);
    setMachineSpecs({ cpus: null, cpuKind: null, memoryMb: null });
    if (machine?.enabled) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    } else if (machine) {
      setMachineState("disabled");
    }
  }, [machineId, machine?.enabled, fetchStatus]);

  if (!machine) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-zinc-500">
        <p>No machines in this workspace. Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Selected machine header */}
      <div className="mb-6 flex items-center gap-4 shrink-0">
        <div className="relative shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold text-zinc-700 ring-2 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-700">
            {machine.name.charAt(0).toUpperCase()}
          </div>
          <StatusBadge state={machineState} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {machine.name}
          </h1>
          {machine.role && (
            <p className="text-sm text-zinc-500">{machine.role}</p>
          )}
        </div>
        {machine.enabled && (
          <div className="ml-auto">
            <ConnectionForm
              ip={machine.ip}
              machineState={machineState}
              cpus={machineSpecs.cpus}
              cpuKind={machineSpecs.cpuKind}
              memoryMb={machineSpecs.memoryMb}
            />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {machine.enabled ? (
          machine.ip ? (
            <iframe
              src={`http://${machine.ip}:3000`}
              className="h-full w-full rounded-lg border border-zinc-200 bg-white dark:border-zinc-700"
              title={`${machine.name} — port 3000`}
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">
              <p>Waiting for IP assignment to load preview...</p>
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <p>This machine is not currently available.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeContent({ machines }: { machines: Machine[] }) {
  return (
    <Suspense>
      <HomeInner machines={machines} />
    </Suspense>
  );
}
