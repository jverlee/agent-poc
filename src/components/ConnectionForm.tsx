"use client";

interface ConnectionFormProps {
  appName: string;
  machineId: string;
  machineState?: string | null;
  onRestart?: () => void;
  restarting?: boolean;
}

const STATE_COLORS: Record<string, string> = {
  started: "bg-emerald-500",
  starting: "bg-yellow-500 animate-pulse",
  stopping: "bg-yellow-500 animate-pulse",
  stopped: "bg-zinc-500",
  replacing: "bg-yellow-500 animate-pulse",
  created: "bg-blue-500",
  destroying: "bg-red-500 animate-pulse",
  destroyed: "bg-red-500",
};

export default function ConnectionForm({
  appName,
  machineId,
  machineState,
  onRestart,
  restarting,
}: ConnectionFormProps) {
  const dotColor = machineState
    ? (STATE_COLORS[machineState] ?? "bg-zinc-500")
    : "bg-zinc-600 animate-pulse";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
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
