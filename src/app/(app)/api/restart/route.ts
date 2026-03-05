import { NextRequest, NextResponse } from "next/server";
import { getMachineById } from "@/lib/supabase/machines";
import { getDropletByIp, restartDroplet } from "@/lib/digitalocean";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { machineId } = body;

  if (!machineId) {
    return NextResponse.json(
      { error: "machineId is required" },
      { status: 400 }
    );
  }

  const machine = await getMachineById(machineId);
  if (!machine || !machine.enabled || !machine.ip) {
    return NextResponse.json(
      { error: "Machine not available" },
      { status: 404 }
    );
  }

  try {
    const droplet = await getDropletByIp(machine.ip);
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
