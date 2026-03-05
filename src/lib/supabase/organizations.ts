import { createClient } from "./server";
import type {
  Profile,
  Organization,
  OrganizationWithRole,
  OrgRole,
} from "../types/organization";

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

export async function getUserOrganizations(): Promise<OrganizationWithRole[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      role,
      organization:organizations(*)
    `
    )
    .eq("user_id", user.id);

  if (error) console.error("getUserOrganizations error:", error);
  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    organization: row.organization as Organization,
    role: row.role as OrgRole,
  }));
}

export async function getActiveOrganization(): Promise<Organization | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();

  if (profile.active_organization_id) {
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.active_organization_id)
      .single();
    if (data) return data as Organization;
  }

  // Fallback: find any org they belong to
  const { data: memberRow } = await supabase
    .from("organization_members")
    .select("organization:organizations(*)")
    .eq("user_id", profile.id)
    .limit(1)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((memberRow as any)?.organization as Organization) ?? null;
}

export async function setActiveOrganization(
  organizationId: string
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // Verify membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .single();

  if (!membership) return false;

  const { error } = await supabase
    .from("profiles")
    .update({
      active_organization_id: organizationId,
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
