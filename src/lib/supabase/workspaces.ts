import { createClient } from "./server";
import type {
  Profile,
  Workspace,
  WorkspaceWithRole,
  WorkspaceRole,
} from "../types/workspace";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) console.error("getCurrentProfile error:", error);
  return (data as Profile) ?? null;
}

export async function getUserWorkspaces(): Promise<WorkspaceWithRole[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      `
      role,
      workspace:workspaces(*)
    `
    )
    .eq("user_id", user.id);

  if (error) console.error("getUserWorkspaces error:", error);
  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    workspace: row.workspace as Workspace,
    role: row.role as WorkspaceRole,
  }));
}

export async function getActiveWorkspace(): Promise<Workspace | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();

  if (profile.active_workspace_id) {
    const { data } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", profile.active_workspace_id)
      .single();
    if (data) return data as Workspace;
  }

  // Fallback: find any workspace they belong to
  const { data: memberRow } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(*)")
    .eq("user_id", profile.id)
    .limit(1)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((memberRow as any)?.workspace as Workspace) ?? null;
}

export async function setActiveWorkspace(
  workspaceId: string
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // Verify membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!membership) return false;

  const { error } = await supabase
    .from("profiles")
    .update({
      active_workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return !error;
}

export async function ensureProfileExists(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (existing) return existing as Profile;

  // Profile missing — call RPC safety net (for pre-trigger users)
  const { error } = await supabase.rpc("ensure_user_profile", {
    p_user_id: user.id,
    p_email: user.email ?? "",
    p_full_name:
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    p_avatar_url: user.user_metadata?.avatar_url ?? null,
  });

  if (error) {
    console.error("Failed to ensure profile:", error);
    return null;
  }

  // Re-fetch the newly created profile
  const { data: created } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (created as Profile) ?? null;
}
