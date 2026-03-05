"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type StatusMap = Record<string, string | null>;

interface StatusContextValue {
  statuses: StatusMap;
  setMachineStatus: (machineId: string, state: string | null) => void;
}

const StatusContext = createContext<StatusContextValue>({
  statuses: {},
  setMachineStatus: () => {},
});

export function useStatuses() {
  return useContext(StatusContext);
}

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<StatusMap>({});

  const fetchAllStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/statuses");
      const data = await res.json();
      if (data.statuses) {
        setStatuses(data.statuses);
      }
    } catch {
      // silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    fetchAllStatuses();
    const interval = setInterval(fetchAllStatuses, 15_000);
    return () => clearInterval(interval);
  }, [fetchAllStatuses]);

  const setMachineStatus = useCallback(
    (machineId: string, state: string | null) => {
      setStatuses((prev) => ({ ...prev, [machineId]: state }));
    },
    []
  );

  return (
    <StatusContext.Provider value={{ statuses, setMachineStatus }}>
      {children}
    </StatusContext.Provider>
  );
}
