import { NextRequest, NextResponse } from "next/server";
import { getMachineById } from "@/lib/supabase/machines";
import { checkSSHConnectivity } from "@/lib/ssh";
import { getDropletByIp } from "@/lib/digitalocean";

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

  if (!machine.enabled || !machine.ip) {
    return NextResponse.json({
      state: "disabled",
      cpus: null,
      cpuKind: null,
      memoryMb: null,
    });
  }

  try {
    const [isOnline, droplet] = await Promise.all([
      checkSSHConnectivity(machine.ip),
      getDropletByIp(machine.ip).catch(() => null),
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
