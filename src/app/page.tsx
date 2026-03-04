"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ConnectionForm from "@/components/ConnectionForm";
import { StatusBadge } from "@/components/status-badge";
import { useStatuses } from "@/components/status-provider";
import { people, findPerson } from "@/lib/people";

const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

function HomeContent() {
  const searchParams = useSearchParams();
  const appName = searchParams.get("app") || "agent-a";
  const machineId = searchParams.get("machine") || "185924c433dd78";

  const person = findPerson(appName, machineId);

  const { setAgentStatus } = useStatuses();
  const [machineState, setMachineState] = useState<string | null>(null);
  const [machineSpecs, setMachineSpecs] = useState<{
    cpus: number | null;
    cpuKind: string | null;
    memoryMb: number | null;
  }>({ cpus: null, cpuKind: null, memoryMb: null });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, machineId }),
      });
      const data = await res.json();
      if (data.state) {
        setMachineState(data.state);
        setAgentStatus(appName, machineId, data.state);
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
  }, [appName, machineId, setAgentStatus]);

  useEffect(() => {
    setMachineState(null);
    setMachineSpecs({ cpus: null, cpuKind: null, memoryMb: null });
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [appName, machineId, fetchStatus]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Selected person header */}
      {person && (
        <div className="mb-6 flex items-center gap-4 shrink-0">
          <div className="relative shrink-0">
            <img
              src={person.avatar}
              alt={person.name}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
            />
            <StatusBadge state={machineState} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {person.name}
            </h1>
            <p className="text-sm text-zinc-500">{person.role}</p>
          </div>
          <div className="ml-auto">
            <ConnectionForm
              appName={appName}
              machineId={machineId}
              machineState={machineState}
              cpus={machineSpecs.cpus}
              cpuKind={machineSpecs.cpuKind}
              memoryMb={machineSpecs.memoryMb}
            />
          </div>
        </div>
      )}
      {!person && (
        <div className="mb-4 shrink-0">
          <ConnectionForm
            appName={appName}
            machineId={machineId}
            machineState={machineState}
            cpus={machineSpecs.cpus}
            cpuKind={machineSpecs.cpuKind}
            memoryMb={machineSpecs.memoryMb}
          />
        </div>
      )}
      <div className="min-h-0 flex-1">
        {people.map((person) => (
          <div
            key={`${person.appName}-${person.machineId}`}
            className="h-full w-full"
            style={{
              display:
                person.appName === appName && person.machineId === machineId
                  ? "block"
                  : "none",
            }}
          >
            <Terminal
              appName={person.appName}
              machineId={person.machineId}
              isActive={person.appName === appName && person.machineId === machineId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
