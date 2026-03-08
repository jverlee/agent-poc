"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Machine } from "@/lib/supabase/machines";

function HomeInner({ machines }: { machines: Machine[] }) {
  const searchParams = useSearchParams();
  const machineId = searchParams.get("machine") || machines[0]?.id;

  const machine = machines.find((m) => m.id === machineId);

  if (!machine) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        <p>No machines in this workspace. Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      {machine.enabled ? (
        machine.ip ? (
          <iframe
            src={`http://${machine.ip}:3000`}
            className="h-full w-full bg-white"
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
  );
}

export default function HomeContent({ machines }: { machines: Machine[] }) {
  return (
    <Suspense>
      <HomeInner machines={machines} />
    </Suspense>
  );
}
