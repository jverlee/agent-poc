import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getMachineById } from "@/lib/supabase/machines";
import { execSSHCommand } from "@/lib/ssh";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

export async function POST(req: NextRequest) {
  try {
    const { skill, machineId } = await req.json();

    if (!skill || typeof skill !== "string") {
      return NextResponse.json({ error: "Missing skill name" }, { status: 400 });
    }
    if (!machineId) {
      return NextResponse.json({ error: "Missing machineId" }, { status: 400 });
    }

    const machine = await getMachineById(machineId);
    if (!machine || !machine.enabled || !machine.ip) {
      return NextResponse.json({ error: "Machine not available" }, { status: 404 });
    }

    // Read the local SKILL.md content
    const srcFile = path.join(SKILLS_DIR, skill, "SKILL.md");
    let content: string;
    try {
      content = await fs.readFile(srcFile, "utf-8");
    } catch {
      return NextResponse.json({ error: `Skill "${skill}" not found` }, { status: 404 });
    }

    // Write the file on the remote machine via SSH
    const destDir = `$HOME/.openclaw/skills/${skill}`;
    const destFile = `${destDir}/SKILL.md`;
    const command = `mkdir -p ${destDir} && cat > ${destFile} << 'SKILLEOF'\n${content}\nSKILLEOF`;

    const result = await execSSHCommand(machine.ip, command);

    return NextResponse.json({ ok: true, dest: destFile, exec: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
