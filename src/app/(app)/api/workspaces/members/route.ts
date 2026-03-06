import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/supabase/workspaces";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeWorkspace = await getActiveWorkspace();
  if (!activeWorkspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  // Verify caller is a member of this workspace
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", activeWorkspace.id)
    .eq("user_id", user.id)
    .single();

  if (!callerMembership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Fetch all members
  const { data: memberRows, error } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, created_at")
    .eq("workspace_id", activeWorkspace.id)
    .order("created_at", { ascending: true });

  if (error || !memberRows) {
    return NextResponse.json(
      { error: "Failed to fetch members", details: error?.message },
      { status: 500 }
    );
  }

  // Fetch profiles for all member user_ids
  const userIds = memberRows.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const members = memberRows.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    profile: profileMap.get(m.user_id) ?? {
      id: m.user_id,
      email: "Unknown",
      full_name: null,
      avatar_url: null,
    },
  }));

  return NextResponse.json({
    members,
    currentUserRole: callerMembership.role,
    currentUserId: user.id,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { membershipId, role } = await request.json();

  if (!membershipId || typeof membershipId !== "string") {
    return NextResponse.json(
      { error: "membershipId is required" },
      { status: 400 }
    );
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const activeWorkspace = await getActiveWorkspace();
  if (!activeWorkspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  // Only owners can update roles (matches RLS policy)
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", activeWorkspace.id)
    .eq("user_id", user.id)
    .single();

  if (!callerMembership || callerMembership.role !== "owner") {
    return NextResponse.json({ error: "Only owners can change roles" }, { status: 403 });
  }

  // Fetch target membership
  const { data: targetMembership } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("id", membershipId)
    .eq("workspace_id", activeWorkspace.id)
    .single();

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMembership.user_id === user.id) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  if (targetMembership.role === "owner") {
    return NextResponse.json(
      { error: "Cannot change owner role" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("id", membershipId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update role", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { membershipId } = await request.json();

  if (!membershipId || typeof membershipId !== "string") {
    return NextResponse.json(
      { error: "membershipId is required" },
      { status: 400 }
    );
  }

  const activeWorkspace = await getActiveWorkspace();
  if (!activeWorkspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  // Verify caller is owner or admin
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", activeWorkspace.id)
    .eq("user_id", user.id)
    .single();

  if (
    !callerMembership ||
    !["owner", "admin"].includes(callerMembership.role)
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Fetch the target membership to apply business rules
  const { data: targetMembership } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("id", membershipId)
    .eq("workspace_id", activeWorkspace.id)
    .single();

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMembership.user_id === user.id) {
    return NextResponse.json(
      { error: "Cannot remove yourself" },
      { status: 400 }
    );
  }

  if (
    targetMembership.role === "owner" &&
    callerMembership.role === "admin"
  ) {
    return NextResponse.json(
      { error: "Admins cannot remove owners" },
      { status: 403 }
    );
  }

  if (
    targetMembership.role === "admin" &&
    callerMembership.role === "admin"
  ) {
    return NextResponse.json(
      { error: "Admins cannot remove other admins" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("id", membershipId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to remove member", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
