import { NextRequest, NextResponse } from "next/server";

const FLY_API_BASE = "https://api.machines.dev/v1";

export async function POST(request: NextRequest) {
  const token = process.env.FLY_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "FLY_API_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { appName, machineId } = body;

  if (!appName || !machineId) {
    return NextResponse.json(
      { error: "appName and machineId are required" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${FLY_API_BASE}/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/restart?force_stop=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Fly.io API error (${res.status}): ${text}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach Fly.io API: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
