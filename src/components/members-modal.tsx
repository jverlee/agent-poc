"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  WorkspaceMemberWithProfile,
  WorkspaceRole,
} from "@/lib/types/workspace";

interface MembersModalProps {
  open: boolean;
  onClose: () => void;
}

export function MembersModal({ open, onClose }: MembersModalProps) {
  const [members, setMembers] = useState<WorkspaceMemberWithProfile[]>([]);
  const [currentUserRole, setCurrentUserRole] =
    useState<WorkspaceRole>("member");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const router = useRouter();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/members");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch members");
        return;
      }
      setMembers(data.members);
      setCurrentUserRole(data.currentUserRole);
      setCurrentUserId(data.currentUserId);
    } catch {
      setError("Failed to fetch members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, fetchMembers]);

  async function handleRemove(membershipId: string) {
    setRemovingId(membershipId);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to remove member");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
      router.refresh();
    } catch {
      setError("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    setUpdatingId(membershipId);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update role");
        return;
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.id === membershipId
            ? { ...m, role: newRole as WorkspaceRole }
            : m
        )
      );
      router.refresh();
    } catch {
      setError("Failed to update role");
    } finally {
      setUpdatingId(null);
    }
  }

  function canChangeRole(member: WorkspaceMemberWithProfile): boolean {
    if (currentUserRole !== "owner") return false;
    if (member.user_id === currentUserId) return false;
    if (member.role === "owner") return false;
    return true;
  }

  const canRemove = ["owner", "admin"].includes(currentUserRole);

  function canRemoveMember(member: WorkspaceMemberWithProfile): boolean {
    if (!canRemove) return false;
    if (member.user_id === currentUserId) return false;
    if (member.role === "owner") return false;
    if (member.role === "admin" && currentUserRole !== "owner") return false;
    return true;
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Workspace Members
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg
              className="h-5 w-5 animate-spin text-zinc-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : error && members.length === 0 ? (
          <p className="py-4 text-center text-sm text-red-500">{error}</p>
        ) : (
          <>
            {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {member.profile.full_name || member.profile.email}
                      {member.user_id === currentUserId && (
                        <span className="ml-1.5 text-xs text-zinc-400">
                          (you)
                        </span>
                      )}
                    </p>
                    {member.profile.full_name && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {member.profile.email}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    {canChangeRole(member) ? (
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.id, e.target.value)
                        }
                        disabled={updatingId === member.id}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    ) : (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {member.role}
                      </span>
                    )}
                    {canRemoveMember(member) && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={removingId === member.id}
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Remove member"
                      >
                        {removingId === member.id ? (
                          <svg
                            className="h-4 w-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
