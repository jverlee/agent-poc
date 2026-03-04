import { NextResponse } from "next/server";
import { people } from "@/lib/people";

const FLY_API_BASE = "https://api.machines.dev/v1";

export async function GET() {
  const token = process.env.FLY_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "FLY_API_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const results = await Promise.allSettled(
    people.map(async (person) => {
      const res = await fetch(
        `${FLY_API_BASE}/apps/${encodeURIComponent(person.appName)}/machines/${encodeURIComponent(person.machineId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return { key: `${person.appName}:${person.machineId}`, state: null };
      const data = await res.json();
      return { key: `${person.appName}:${person.machineId}`, state: data.state };
    })
  );

  const statuses: Record<string, string | null> = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      statuses[result.value.key] = result.value.state;
    }
  }

  return NextResponse.json({ statuses });
}
