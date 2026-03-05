import { NextRequest, NextResponse } from "next/server";
import { getMachineById, deleteMachineRecord } from "@/lib/supabase/machines";
import { getDropletByIp, deleteDroplet } from "@/lib/digitalocean";

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
  if (!machine) {
    return NextResponse.json(
      { error: "Machine not found" },
      { status: 404 }
    );
  }

  try {
    if (machine.ip) {
      const droplet = await getDropletByIp(machine.ip);
      if (droplet) {
        await deleteDroplet(droplet.id);
      }
    }

    await deleteMachineRecord(machineId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Destroy failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
