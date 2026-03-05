import { NextRequest, NextResponse } from "next/server";
import { getMachineById } from "@/lib/supabase/machines";
import { execSSHCommand } from "@/lib/ssh";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { machineId, command } = body;

  if (!machineId || !command) {
    return NextResponse.json(
      { error: "machineId and command are required" },
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
    const result = await execSSHCommand(machine.ip, command);
    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.code,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `SSH exec failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
