"use client";

interface ConnectionFormProps {
  appName: string;
  machineId: string;
  machineState?: string | null;
  cpus?: number | null;
  cpuKind?: string | null;
  memoryMb?: number | null;
}

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export default function ConnectionForm({
  appName,
  machineId,
  machineState,
  cpus,
  cpuKind,
  memoryMb,
}: ConnectionFormProps) {
  const hasSpecs = cpus != null && memoryMb != null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span>
          {appName} / {machineId}
        </span>
        {machineState && (
          <span className="text-xs text-zinc-500">{machineState}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {hasSpecs && (
          <span className="text-xs text-zinc-500">
            {cpus} {cpuKind ?? ""} vCPU{cpus > 1 ? "s" : ""} · {formatMemory(memoryMb)}
          </span>
        )}
      </div>
    </div>
  );
}
