import { NextRequest, NextResponse } from "next/server";
import { setActiveWorkspace } from "@/lib/supabase/workspaces";

export async function POST(request: NextRequest) {
  const { workspaceId } = await request.json();

  if (!workspaceId || typeof workspaceId !== "string") {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 }
    );
  }

  const success = await setActiveWorkspace(workspaceId);
  if (!success) {
    return NextResponse.json(
      { error: "Failed to switch workspace. You may not be a member." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
