import { NextRequest, NextResponse } from "next/server";
import { people } from "@/lib/people";
import { execSSHCommand } from "@/lib/ssh";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { personIndex, command } = body;

  if (personIndex === undefined || !command) {
    return NextResponse.json(
      { error: "personIndex and command are required" },
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
    const result = await execSSHCommand(person.ip, command);
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
