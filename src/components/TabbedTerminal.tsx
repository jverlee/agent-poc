"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Terminal, { TerminalHandle } from "./Terminal";

interface Tab {
  id: string;
  label: string;
}

interface TabbedTerminalProps {
  machineId: string;
  machineName: string;
  isActive: boolean;
}

let tabCounter = 0;

export default function TabbedTerminal({
  machineId,
  machineName,
  isActive,
}: TabbedTerminalProps) {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    tabCounter += 1;
    return [{ id: String(tabCounter), label: "Terminal 1" }];
  });
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map());
  const labelCounter = useRef(1);

  const setTerminalRef = useCallback(
    (tabId: string) => (handle: TerminalHandle | null) => {
      if (handle) {
        terminalRefs.current.set(tabId, handle);
      } else {
        terminalRefs.current.delete(tabId);
      }
    },
    []
  );

  function addTab() {
    labelCounter.current += 1;
    tabCounter += 1;
    const newTab: Tab = {
      id: String(tabCounter),
      label: `Terminal ${labelCounter.current}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function closeTab(tabId: string) {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const newTabs = prev.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        const newIndex = Math.min(closedIndex, newTabs.length - 1);
        setActiveTabId(newTabs[newIndex].id);
      }
      return newTabs;
    });
  }

  // Forward terminal-send-command to the active tab only
  useEffect(() => {
    const onSendCommand = (e: Event) => {
      if (!isActive) return;
      const command = (e as CustomEvent<string>).detail;
      const activeTerminal = terminalRefs.current.get(activeTabId);
      if (activeTerminal && command) {
        activeTerminal.sendCommand(command);
      }
    };
    window.addEventListener("terminal-send-command", onSendCommand);
    return () => window.removeEventListener("terminal-send-command", onSendCommand);
  }, [activeTabId, isActive]);

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-800 overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-zinc-800 bg-zinc-900">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
              tab.id === activeTabId
                ? "border-zinc-400 text-zinc-200 bg-zinc-800/50"
                : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
            }`}
          >
            <span>{tab.label}</span>
            {tabs.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 rounded p-0.5 text-zinc-600 hover:bg-zinc-700 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          onClick={addTab}
          className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 transition-colors"
          title="New terminal"
        >
          +
        </button>
      </div>

      {/* Terminal panels */}
      <div className="min-h-0 flex-1 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="h-full w-full absolute inset-0"
            style={{ display: tab.id === activeTabId ? "block" : "none" }}
          >
            <Terminal
              ref={setTerminalRef(tab.id)}
              machineId={machineId}
              machineName={machineName}
              isActive={isActive && tab.id === activeTabId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
