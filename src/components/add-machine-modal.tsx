"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const REGIONS = [
  { value: "nyc1", label: "New York 1" },
  { value: "nyc3", label: "New York 3" },
  { value: "sfo3", label: "San Francisco 3" },
  { value: "ams3", label: "Amsterdam 3" },
  { value: "sgp1", label: "Singapore 1" },
  { value: "lon1", label: "London 1" },
  { value: "fra1", label: "Frankfurt 1" },
  { value: "tor1", label: "Toronto 1" },
  { value: "blr1", label: "Bangalore 1" },
  { value: "syd1", label: "Sydney 1" },
];

const SIZES = [
  { value: "s-1vcpu-512mb-10gb", label: "512 MB / 1 vCPU", memory: "512 MB", cpu: "1 vCPU" },
  { value: "s-1vcpu-1gb", label: "1 GB / 1 vCPU", memory: "1 GB", cpu: "1 vCPU" },
  { value: "s-1vcpu-2gb", label: "2 GB / 1 vCPU", memory: "2 GB", cpu: "1 vCPU" },
  { value: "s-2vcpu-4gb", label: "4 GB / 2 vCPUs", memory: "4 GB", cpu: "2 vCPUs" },
  { value: "s-4vcpu-8gb", label: "8 GB / 4 vCPUs", memory: "8 GB", cpu: "4 vCPUs" },
];

const STEPS = [
  { key: "ssh_key", label: "Registering SSH key" },
  { key: "droplet", label: "Creating droplet" },
  { key: "ip", label: "Waiting for IP address" },
  { key: "saving", label: "Saving machine" },
] as const;

type StepStatus = "pending" | "in_progress" | "done" | "error";

interface AddMachineModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddMachineModal({ open, onClose }: AddMachineModalProps) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("nyc1");
  const [size, setSize] = useState("s-1vcpu-1gb");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, StepStatus>>({});
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (!loading) onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose, loading]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    setSteps({});

    try {
      const res = await fetch("/api/machines/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          region,
          size,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create machine");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.step === "complete" && event.status === "done") {
              completed = true;
            } else if (event.step === "error" || event.status === "error") {
              setError(event.error || "An error occurred");
            } else {
              setSteps((prev) => ({ ...prev, [event.step]: event.status }));
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      if (completed) {
        setName("");
        setRegion("nyc1");
        setSize("s-1vcpu-1gb");
        setSteps({});
        onClose();
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const selectedSize = SIZES.find((s) => s.value === size);
  const showProgress = loading || Object.keys(steps).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={ref}
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Add Machine
        </h2>

        {showProgress ? (
          <div className="space-y-3 py-2">
            {STEPS.map(({ key, label }) => {
              const status = steps[key] || "pending";
              return (
                <div key={key} className="flex items-center gap-3">
                  <StepIcon status={status} />
                  <span
                    className={`text-sm ${
                      status === "in_progress"
                        ? "font-medium text-zinc-900 dark:text-zinc-100"
                        : status === "done"
                          ? "text-zinc-500 dark:text-zinc-400"
                          : status === "error"
                            ? "text-red-500"
                            : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
            {error && (
              <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-machine"
                autoFocus
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {selectedSize && (
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedSize.memory} RAM, {selectedSize.cpu}
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={!name.trim() || loading}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Create Machine
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "in_progress") {
    return (
      <svg className="h-4 w-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  // pending
  return <div className="h-4 w-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />;
}
