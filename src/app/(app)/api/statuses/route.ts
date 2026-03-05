import { NextResponse } from "next/server";
import { people } from "@/lib/people";
import { checkSSHConnectivity } from "@/lib/ssh";

export async function GET() {
  const results = await Promise.allSettled(
    people.map(async (person, index) => {
      if (!person.enabled || !person.ip) {
        return { key: String(index), state: "disabled" };
      }
      const isOnline = await checkSSHConnectivity(person.ip);
      return { key: String(index), state: isOnline ? "started" : "stopped" };
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
