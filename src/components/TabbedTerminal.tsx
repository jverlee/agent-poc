"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Terminal, { TerminalHandle } from "./Terminal";
import TerminalInput from "./terminal-input";

interface Tab {
  id: string;
  label: string;
  sessionName: string;
  autoCommand?: string;
}

interface TabbedTerminalProps {
  machineId: string;
  machineName: string;
  isActive: boolean;
}

const CLAUDE_AUTO_COMMAND =
  "command -v claude >/dev/null 2>&1 && (claude --continue || claude) || echo 'Claude Code not installed. Run: npm install -g @anthropic-ai/claude-code'";

function getStorageKey(machineId: string) {
  return `lome-tabs-${machineId}`;
}

function makeSessionName(machineId: string, suffix: string) {
  return `lome-${machineId.slice(0, 8)}-${suffix}`;
}

function loadTabs(machineId: string): { tabs: Tab[]; activeTabId: string } | null {
  try {
    const raw = localStorage.getItem(getStorageKey(machineId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.tabs?.length > 0 && parsed.activeTabId) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function saveTabs(machineId: string, tabs: Tab[], activeTabId: string) {
  try {
    localStorage.setItem(
      getStorageKey(machineId),
      JSON.stringify({ tabs, activeTabId })
    );
  } catch {
    // ignore
  }
}

function createDefaultTabs(machineId: string): Tab[] {
  return [
    {
      id: `${machineId}-claude`,
      label: "Claude Code",
      sessionName: makeSessionName(machineId, "claude"),
      autoCommand: CLAUDE_AUTO_COMMAND,
    },
  ];
}

export default function TabbedTerminal({
  machineId,
  machineName,
  isActive,
}: TabbedTerminalProps) {
  const tabCounter = useRef(1);
  const labelCounter = useRef(1);

  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = loadTabs(machineId);
    if (saved) {
      // Find highest tab number for counter
      for (const t of saved.tabs) {
        const match = t.id.match(/-(\d+)$/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n >= tabCounter.current) tabCounter.current = n;
          if (n >= labelCounter.current) labelCounter.current = n;
        }
      }
      return saved.tabs;
    }
    return createDefaultTabs(machineId);
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const saved = loadTabs(machineId);
    if (saved) return saved.activeTabId;
    return `${machineId}-claude`;
  });

  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map());
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [authStep, setAuthStep] = useState<"sign-in" | "paste-code">("sign-in");

  // Persist tab state on changes
  useEffect(() => {
    saveTabs(machineId, tabs, activeTabId);
  }, [machineId, tabs, activeTabId]);

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
    tabCounter.current += 1;
    const newTab: Tab = {
      id: `${machineId}-${tabCounter.current}`,
      label: `Terminal ${labelCounter.current}`,
      sessionName: makeSessionName(machineId, String(tabCounter.current)),
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }

  function startRenaming(tabId: string, currentLabel: string) {
    setEditingTabId(tabId);
    setEditValue(currentLabel);
  }

  function commitRename() {
    if (editingTabId && editValue.trim()) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === editingTabId ? { ...t, label: editValue.trim() } : t
        )
      );
    }
    setEditingTabId(null);
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
    <div className="flex h-full flex-col rounded-lg overflow-hidden">
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
            {editingTabId === tab.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingTabId(null);
                }}
                className="w-20 bg-transparent text-xs text-zinc-200 outline-none border-b border-zinc-500"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span onDoubleClick={() => startRenaming(tab.id, tab.label)}>
                {tab.label}
              </span>
            )}
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
        {authUrl && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="text-lg font-medium text-zinc-200">Claude needs to sign in</div>
              {authStep === "sign-in" ? (
                <>
                  <p className="text-sm text-zinc-400 max-w-sm text-center">
                    Click below to open the authentication page in your browser.
                  </p>
                  <button
                    onClick={() => {
                      window.open(authUrl, "_blank");
                      setAuthStep("paste-code");
                    }}
                    className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                  >
                    Open Sign-In
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-400 max-w-sm text-center">
                    Paste the code from the browser below.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (authCode.trim()) {
                        const activeTerminal = terminalRefs.current.get(activeTabId);
                        if (activeTerminal) {
                          activeTerminal.sendCommand(authCode.trim());
                        }
                        setAuthUrl(null);
                        setAuthCode("");
                        setAuthStep("sign-in");
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      placeholder="Paste code here"
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-500 w-64"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                      Submit
                    </button>
                  </form>
                </>
              )}
              <button
                onClick={() => {
                  setAuthUrl(null);
                  setAuthCode("");
                  setAuthStep("sign-in");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
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
              sessionName={tab.sessionName}
              autoCommand={tab.autoCommand}
              onAuthUrl={tab.id === activeTabId ? setAuthUrl : undefined}
            />
          </div>
        ))}
      </div>

      {/* Compose bar */}
      <TerminalInput
        machineId={machineId}
        onSend={(text) => {
          const activeTerminal = terminalRefs.current.get(activeTabId);
          if (activeTerminal) {
            activeTerminal.sendCommand(text);
          }
        }}
      />
    </div>
  );
}
