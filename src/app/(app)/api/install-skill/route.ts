import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { people } from "@/lib/people";
import { execSSHCommand } from "@/lib/ssh";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");

export async function POST(req: NextRequest) {
  try {
    const { skill, personIndex } = await req.json();

    if (!skill || typeof skill !== "string") {
      return NextResponse.json({ error: "Missing skill name" }, { status: 400 });
    }
    if (personIndex === undefined) {
      return NextResponse.json({ error: "Missing personIndex" }, { status: 400 });
    }

    const person = people[personIndex];
    if (!person || !person.enabled || !person.ip) {
      return NextResponse.json({ error: "Agent not available" }, { status: 404 });
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
    const destDir = `/app/${skill}`;
    const destFile = `${destDir}/SKILL.md`;
    const command = `mkdir -p ${destDir} && cat > ${destFile} << 'SKILLEOF'\n${content}\nSKILLEOF`;

    const result = await execSSHCommand(person.ip, command);

    return NextResponse.json({ ok: true, dest: destFile, exec: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
