"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ConnectionForm from "@/components/ConnectionForm";

const Terminal = dynamic(() => import("@/components/Terminal"), { ssr: false });

interface Connection {
  appName: string;
  machineId: string;
}

export default function Home() {
  const [connection, setConnection] = useState<Connection | null>(null);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4 shrink-0">
        <ConnectionForm
          onConnect={(appName, machineId) =>
            setConnection({ appName, machineId })
          }
          connected={!!connection}
          appName={connection?.appName}
          machineId={connection?.machineId}
          onDisconnect={() => setConnection(null)}
        />
      </div>
      <div className="min-h-0 flex-1">
        {connection ? (
          <Terminal
            appName={connection.appName}
            machineId={connection.machineId}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 bg-[#18181b]">
            <p className="text-sm text-zinc-500">
              Enter an app name and machine ID to connect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
