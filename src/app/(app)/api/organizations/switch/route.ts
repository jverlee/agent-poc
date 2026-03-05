import { NextRequest, NextResponse } from "next/server";
import { setActiveOrganization } from "@/lib/supabase/organizations";

export async function POST(request: NextRequest) {
  const { organizationId } = await request.json();

  if (!organizationId || typeof organizationId !== "string") {
    return NextResponse.json(
      { error: "organizationId is required" },
      { status: 400 }
    );
  }

  const success = await setActiveOrganization(organizationId);
  if (!success) {
    return NextResponse.json(
      { error: "Failed to switch organization. You may not be a member." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
