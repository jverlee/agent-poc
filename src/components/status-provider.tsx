"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type StatusMap = Record<string, string | null>;

interface StatusContextValue {
  statuses: StatusMap;
  setAgentStatus: (personIndex: number, state: string | null) => void;
}

const StatusContext = createContext<StatusContextValue>({
  statuses: {},
  setAgentStatus: () => {},
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

  const setAgentStatus = useCallback(
    (personIndex: number, state: string | null) => {
      setStatuses((prev) => ({ ...prev, [String(personIndex)]: state }));
    },
    []
  );

  return (
    <StatusContext.Provider value={{ statuses, setAgentStatus }}>
      {children}
    </StatusContext.Provider>
  );
}
