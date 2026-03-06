"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceWithRole, Workspace } from "@/lib/types/workspace";
import { InviteModal } from "@/components/invite-modal";
import { MembersModal } from "@/components/members-modal";

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceWithRole[];
  activeWorkspace: Workspace;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [showEllipsisMenu, setShowEllipsisMenu] = useState<string | null>(null);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const currentRole = workspaces.find(
    (w) => w.workspace.id === activeWorkspace.id
  )?.role;
  const isOwner = currentRole === "owner";
  const isAdminOrOwner = isOwner || currentRole === "admin";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
        setRenaming(null);
        setRenameName("");
        setShowEllipsisMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function switchWorkspace(wsId: string) {
    if (wsId === activeWorkspace.id) {
      setOpen(false);
      return;
    }

    const res = await fetch("/api/workspaces/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: wsId }),
    });

    if (res.ok) {
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    const res = await fetch("/api/workspaces/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (res.ok) {
      setCreating(false);
      setNewName("");
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function renameWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!renameName.trim() || !renaming) return;

    const res = await fetch("/api/workspaces/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: renaming, name: renameName.trim() }),
    });

    if (res.ok) {
      setRenaming(null);
      setRenameName("");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="relative -ml-1 mt-0.5" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-sm text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <span className="truncate">{activeWorkspace.name}</span>
        <svg
          className="h-3 w-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {workspaces.map(({ workspace, role }) => (
            <div key={workspace.id} className="relative">
              {renaming === workspace.id ? (
                <form onSubmit={renameWorkspace} className="p-2">
                  <input
                    type="text"
                    value={renameName}
                    onChange={(e) => setRenameName(e.target.value)}
                    placeholder="New name"
                    autoFocus
                    className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setRenaming(null);
                        setRenameName("");
                      }
                    }}
                  />
                  <div className="mt-1 flex gap-1">
                    <button
                      type="submit"
                      disabled={!renameName.trim() || isPending}
                      className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenaming(null);
                        setRenameName("");
                      }}
                      className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center">
                  <button
                    onClick={() => switchWorkspace(workspace.id)}
                    disabled={isPending}
                    className={`flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                      workspace.id === activeWorkspace.id
                        ? "font-medium text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="min-w-0 truncate">{workspace.name}</span>
                    <span className="ml-2 shrink-0 text-zinc-400">{role}</span>
                  </button>
                  {role === "owner" && (
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEllipsisMenu(
                            showEllipsisMenu === workspace.id ? null : workspace.id
                          );
                        }}
                        className="px-1.5 py-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {showEllipsisMenu === workspace.id && (
                        <div className="absolute right-0 top-full z-50 mt-1 min-w-[120px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                          <button
                            onClick={() => {
                              setShowEllipsisMenu(null);
                              setRenaming(workspace.id);
                              setRenameName(workspace.name);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Rename
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="border-t border-zinc-200 dark:border-zinc-700">
            {creating ? (
              <form onSubmit={createWorkspace} className="p-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  autoFocus
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="mt-1 flex gap-1">
                  <button
                    type="submit"
                    disabled={!newName.trim() || isPending}
                    className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create workspace
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowInvite(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Invite members
                </button>
                {isAdminOrOwner && (
                  <button
                    onClick={() => {
                      setOpen(false);
                      setShowMembers(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Manage members
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
      />
      <MembersModal
        open={showMembers}
        onClose={() => setShowMembers(false)}
      />
    </div>
  );
}
