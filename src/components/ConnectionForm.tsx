"use client";

interface ConnectionFormProps {
  appName: string;
  machineId: string;
  machineState?: string | null;
  onRestart?: () => void;
  restarting?: boolean;
}

export default function ConnectionForm({
  appName,
  machineId,
  machineState,
  onRestart,
  restarting,
}: ConnectionFormProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span>
          {appName} / {machineId}
        </span>
        {machineState && (
          <span className="text-xs text-zinc-500">{machineState}</span>
        )}
      </div>
      {onRestart && (
        <button
          onClick={onRestart}
          disabled={restarting}
          className="rounded-md border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
        >
          {restarting ? "Restarting…" : "Force Restart"}
        </button>
      )}
    </div>
  );
}
