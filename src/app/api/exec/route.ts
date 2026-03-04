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
  const { appName, machineId, command } = body;

  if (!appName || !machineId || !command) {
    return NextResponse.json(
      { error: "appName, machineId, and command are required" },
      { status: 400 }
    );
  }

  const commandParts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const parsed = commandParts.map((part: string) =>
    part.replace(/^["']|["']$/g, "")
  );

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "Empty command" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${FLY_API_BASE}/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/exec`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: parsed,
          timeout: 60,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Fly.io API error (${res.status}): ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach Fly.io API: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
