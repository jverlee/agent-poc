"use client";

import { useState } from "react";

interface ConnectionFormProps {
  onConnect: (appName: string, machineId: string) => void;
  connected: boolean;
  appName?: string;
  machineId?: string;
  onDisconnect: () => void;
}

export default function ConnectionForm({
  onConnect,
  connected,
  appName: connectedApp,
  machineId: connectedMachine,
  onDisconnect,
}: ConnectionFormProps) {
  const [appName, setAppName] = useState("");
  const [machineId, setMachineId] = useState("");

  if (connected) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            {connectedApp} / {connectedMachine}
          </span>
        </div>
        <button
          onClick={onDisconnect}
          className="rounded-md px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (appName.trim() && machineId.trim()) {
          onConnect(appName.trim(), machineId.trim());
        }
      }}
      className="flex items-end gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="appName" className="text-xs font-medium text-zinc-400">
          App Name
        </label>
        <input
          id="appName"
          type="text"
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          placeholder="my-fly-app"
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="machineId"
          className="text-xs font-medium text-zinc-400"
        >
          Machine ID
        </label>
        <input
          id="machineId"
          type="text"
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          placeholder="d8d920e5c..."
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
      >
        Connect
      </button>
    </form>
  );
}
