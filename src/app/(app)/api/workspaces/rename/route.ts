import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, name } = await request.json();

  if (!workspaceId || typeof workspaceId !== "string") {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Verify caller is owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership || membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can rename workspaces" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ name: name.trim() })
    .eq("id", workspaceId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to rename workspace", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
