import { NextResponse } from "next/server";
import { getWorkspaceMachines } from "@/lib/supabase/machines";
import { getActiveWorkspace } from "@/lib/supabase/workspaces";
import { checkSSHConnectivity } from "@/lib/ssh";

export async function GET() {
  const activeWorkspace = await getActiveWorkspace();
  if (!activeWorkspace) {
    return NextResponse.json({ statuses: {} });
  }

  const machines = await getWorkspaceMachines(activeWorkspace.id);

  const results = await Promise.allSettled(
    machines.map(async (machine) => {
      if (!machine.enabled || !machine.ip) {
        return { key: machine.id, state: "disabled" };
      }
      const isOnline = await checkSSHConnectivity(machine.ip);
      return { key: machine.id, state: isOnline ? "started" : "stopped" };
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
