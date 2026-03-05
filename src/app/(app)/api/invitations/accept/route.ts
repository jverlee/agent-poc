import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(request.url).origin;

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await createClient();

  // Look up the invitation
  const { data: invitation, error } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (error || !invitation) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invitation`);
  }

  if (invitation.status === "accepted") {
    return NextResponse.redirect(`${origin}/login?error=invitation_already_used`);
  }

  if (new Date(invitation.expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from("workspace_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);
    return NextResponse.redirect(`${origin}/login?error=invitation_expired`);
  }

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // User is logged in — add them to the workspace
    const { error: memberError } = await supabase
      .from("workspace_members")
      .upsert(
        {
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role,
        },
        { onConflict: "workspace_id,user_id" }
      );

    if (!memberError) {
      // Mark invitation as accepted
      await supabase
        .from("workspace_invitations")
        .update({ status: "accepted" })
        .eq("id", invitation.id);

      // Set as active workspace
      await supabase
        .from("profiles")
        .update({
          active_workspace_id: invitation.workspace_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return NextResponse.redirect(origin);
  }

  // User is not logged in — redirect to login with invite token
  return NextResponse.redirect(
    `${origin}/login?invite_token=${token}`
  );
}
