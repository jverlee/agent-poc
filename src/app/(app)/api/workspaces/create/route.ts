import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { name } = await request.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate slug from name
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure slug uniqueness
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Create workspace (generate ID upfront so we can add the member
  // before needing to SELECT — the SELECT RLS policy requires membership)
  const workspaceId = crypto.randomUUID();
  const trimmedName = name.trim();

  const { error: wsError } = await supabase
    .from("workspaces")
    .insert({
      id: workspaceId,
      name: trimmedName,
      slug,
      is_personal: false,
      created_by: user.id,
    });

  if (wsError) {
    return NextResponse.json(
      { error: `Failed to create workspace: ${wsError.message}` },
      { status: 500 }
    );
  }

  // Add user as owner
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    return NextResponse.json(
      { error: `Failed to add membership: ${memberError.message}` },
      { status: 500 }
    );
  }

  // Set as active workspace
  await supabase
    .from("profiles")
    .update({
      active_workspace_id: workspaceId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return NextResponse.json({
    workspace: { id: workspaceId, name: trimmedName, slug, is_personal: false },
  });
}
