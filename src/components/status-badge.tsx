const stateColors: Record<string, string> = {
  started: "bg-emerald-500",
  starting: "bg-yellow-500 animate-pulse",
  stopping: "bg-yellow-500 animate-pulse",
  stopped: "bg-zinc-500",
  replacing: "bg-yellow-500 animate-pulse",
  created: "bg-blue-500",
  destroying: "bg-red-500 animate-pulse",
  destroyed: "bg-red-500",
};

export function StatusBadge({
  state,
  size = "lg",
}: {
  state: string | null | undefined;
  size?: "sm" | "lg";
}) {
  const sizeClasses = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const colorClass = state
    ? (stateColors[state] ?? "bg-zinc-500")
    : "bg-zinc-600 animate-pulse";

  return (
    <span
      className={`absolute bottom-0 right-0 block ${sizeClasses} rounded-full ring-2 ring-white dark:ring-zinc-900 ${colorClass}`}
    />
  );
}
