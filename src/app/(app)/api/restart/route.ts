import { NextRequest, NextResponse } from "next/server";
import { people } from "@/lib/people";
import { getDropletByIp, restartDroplet } from "@/lib/digitalocean";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { personIndex } = body;

  if (personIndex === undefined) {
    return NextResponse.json(
      { error: "personIndex is required" },
      { status: 400 }
    );
  }

  const person = people[personIndex];
  if (!person || !person.enabled || !person.ip) {
    return NextResponse.json(
      { error: "Agent not available" },
      { status: 404 }
    );
  }

  try {
    const droplet = await getDropletByIp(person.ip);
    if (!droplet) {
      return NextResponse.json(
        { error: "Droplet not found for this IP" },
        { status: 404 }
      );
    }

    await restartDroplet(droplet.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Restart failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
