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

  const { metadata } = await request.json();

  if (!metadata || typeof metadata !== "object") {
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
  }

  // Merge new metadata with existing
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", user.id)
    .single();

  const existing = (profile?.metadata as Record<string, unknown>) ?? {};
  const merged = { ...existing, ...metadata };

  const { error } = await supabase
    .from("profiles")
    .update({
      metadata: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
