import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/?slack_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?slack_error=no_code`);
  }

  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${origin}/auth/slack/callback`,
      }),
    });

    const data = await tokenRes.json();

    if (!data.ok) {
      return NextResponse.redirect(
        `${origin}/?slack_error=${encodeURIComponent(data.error || "token_exchange_failed")}`
      );
    }

    const botToken = data.access_token;
    const redirectUrl = new URL("/", origin);
    redirectUrl.searchParams.set("slack_bot_token", botToken);
    if (state) {
      redirectUrl.searchParams.set("machine", state);
    }

    return NextResponse.redirect(redirectUrl.toString());
  } catch {
    return NextResponse.redirect(`${origin}/?slack_error=exchange_failed`);
  }
}
