import { NextRequest, NextResponse } from "next/server";
import { people } from "@/lib/people";
import { checkSSHConnectivity } from "@/lib/ssh";
import { getDropletByIp } from "@/lib/digitalocean";

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
  if (!person) {
    return NextResponse.json(
      { error: "Person not found" },
      { status: 404 }
    );
  }

  if (!person.enabled || !person.ip) {
    return NextResponse.json({
      state: "disabled",
      cpus: null,
      cpuKind: null,
      memoryMb: null,
    });
  }

  try {
    const [isOnline, droplet] = await Promise.all([
      checkSSHConnectivity(person.ip),
      getDropletByIp(person.ip).catch(() => null),
    ]);

    return NextResponse.json({
      state: isOnline ? "started" : "stopped",
      cpus: droplet?.size?.vcpus ?? null,
      cpuKind: "shared",
      memoryMb: droplet?.size?.memory ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to check status: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
