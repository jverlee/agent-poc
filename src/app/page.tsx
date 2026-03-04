"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import ConnectionForm from "@/components/ConnectionForm";
import { findPerson } from "@/lib/people";

const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

function HomeContent() {
  const searchParams = useSearchParams();
  const appName = searchParams.get("app") || "agent-a";
  const machineId = searchParams.get("machine") || "185924c433dd78";

  const person = findPerson(appName, machineId);

  const [restarting, setRestarting] = useState(false);
  const [machineState, setMachineState] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, machineId }),
      });
      const data = await res.json();
      if (data.state) setMachineState(data.state);
    } catch {
      // silently ignore polling errors
    }
  }, [appName, machineId]);

  useEffect(() => {
    setMachineState(null);
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [appName, machineId, fetchStatus]);

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
      } else {
        setMachineState(null);
        setTimeout(fetchStatus, 1000);
        setTimeout(fetchStatus, 3000);
      }
    } catch (err) {
      alert(`Restart failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Selected person header */}
      {person && (
        <div className="mb-6 flex items-center gap-4 shrink-0">
          <img
            src={person.avatar}
            alt={person.name}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-zinc-200 dark:ring-zinc-700"
          />
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
              onRestart={handleRestart}
              restarting={restarting}
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
            onRestart={handleRestart}
            restarting={restarting}
          />
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Terminal appName={appName} machineId={machineId} />
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
