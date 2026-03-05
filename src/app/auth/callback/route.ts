import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileExists } from "@/lib/supabase/workspaces";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite_token");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await ensureProfileExists();

      // If there's an invite token, redirect to accept it
      if (inviteToken) {
        return NextResponse.redirect(
          `${origin}/api/invitations/accept?token=${inviteToken}`
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
