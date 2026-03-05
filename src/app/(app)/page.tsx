"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ConnectionForm from "@/components/ConnectionForm";
import { StatusBadge } from "@/components/status-badge";
import { useStatuses } from "@/components/status-provider";
import { people } from "@/lib/people";

const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

function HomeContent() {
  const searchParams = useSearchParams();
  const personIndex = parseInt(searchParams.get("person") || "0", 10);

  const person = people[personIndex];

  const { setAgentStatus } = useStatuses();
  const [machineState, setMachineState] = useState<string | null>(null);
  const [machineSpecs, setMachineSpecs] = useState<{
    cpus: number | null;
    cpuKind: string | null;
    memoryMb: number | null;
  }>({ cpus: null, cpuKind: null, memoryMb: null });

  const fetchStatus = useCallback(async () => {
    if (!person?.enabled) return;
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIndex }),
      });
      const data = await res.json();
      if (data.state) {
        setMachineState(data.state);
        setAgentStatus(personIndex, data.state);
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
  }, [personIndex, person?.enabled, setAgentStatus]);

  useEffect(() => {
    setMachineState(null);
    setMachineSpecs({ cpus: null, cpuKind: null, memoryMb: null });
    if (person?.enabled) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    } else {
      setMachineState("disabled");
    }
  }, [personIndex, person?.enabled, fetchStatus]);

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
          {person.enabled && (
            <div className="ml-auto">
              <ConnectionForm
                personIndex={personIndex}
                ip={person.ip}
                machineState={machineState}
                cpus={machineSpecs.cpus}
                cpuKind={machineSpecs.cpuKind}
                memoryMb={machineSpecs.memoryMb}
              />
            </div>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {person?.enabled ? (
          people.map((p, index) => {
            if (!p.enabled) return null;
            return (
              <div
                key={index}
                className="h-full w-full"
                style={{
                  display: index === personIndex ? "block" : "none",
                }}
              >
                <Terminal
                  personIndex={index}
                  personName={p.name}
                  isActive={index === personIndex}
                />
              </div>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <p>This agent is not currently available.</p>
          </div>
        )}
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
