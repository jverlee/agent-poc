import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/supabase/workspaces";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, role = "member" } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const activeWorkspace = await getActiveWorkspace();
  if (!activeWorkspace) {
    return NextResponse.json({ error: "No active workspace" }, { status: 400 });
  }

  // Verify caller is owner or admin
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", activeWorkspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Check if email is already a member
  const { data: profileMatch } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (profileMatch) {
    const { data: alreadyMember } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", activeWorkspace.id)
      .eq("user_id", profileMatch.id)
      .single();

    if (alreadyMember) {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 409 }
      );
    }
  }

  // Check for existing invitation
  const normalizedEmail = email.toLowerCase().trim();
  const { data: existing } = await supabase
    .from("workspace_invitations")
    .select("id")
    .eq("workspace_id", activeWorkspace.id)
    .eq("email", normalizedEmail)
    .maybeSingle();

  let invitation;
  let error;

  if (existing) {
    // Update existing invitation with new token and expiry
    ({ data: invitation, error } = await supabase
      .from("workspace_invitations")
      .update({
        role,
        invited_by: user.id,
        status: "pending",
        token: crypto.randomUUID(),
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    // Create new invitation
    ({ data: invitation, error } = await supabase
      .from("workspace_invitations")
      .insert({
        workspace_id: activeWorkspace.id,
        email: normalizedEmail,
        role,
        invited_by: user.id,
        status: "pending",
        token: crypto.randomUUID(),
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      })
      .select()
      .single());
  }

  if (error) {
    console.error("Failed to create invitation:", error);
    return NextResponse.json(
      { error: "Failed to create invitation", details: error.message },
      { status: 500 }
    );
  }

  // Send invitation email via Resend
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
  const acceptUrl = `${appUrl}/api/invitations/accept?token=${invitation.token}`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: "Workmate <invites@pigeon.sendwithmanifest.com>",
      to: email.toLowerCase().trim(),
      subject: `You've been invited to ${activeWorkspace.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #18181b; margin-bottom: 8px;">Join ${activeWorkspace.name}</h2>
          <p style="color: #71717a; margin-bottom: 24px;">
            ${user.user_metadata?.full_name || user.email} has invited you to join
            <strong>${activeWorkspace.name}</strong> on Workmate as a ${role}.
          </p>
          <a href="${acceptUrl}"
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            Accept Invitation
          </a>
          <p style="color: #a1a1aa; font-size: 12px; margin-top: 24px;">
            This invitation expires in 7 days.
          </p>
        </div>
      `,
    });
  } catch (emailErr) {
    console.error("Failed to send invitation email:", emailErr);
    // Invitation is still created, just email failed
  }

  return NextResponse.json({ success: true, invitation });
}
