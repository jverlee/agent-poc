import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const SKILLS_DIR = path.resolve(process.cwd(), "skills");
const FLY_API_BASE = "https://api.machines.dev/v1";

export async function POST(req: NextRequest) {
  const token = process.env.FLY_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "FLY_API_TOKEN is not configured" },
      { status: 500 }
    );
  }

  try {
    const { skill, appName, machineId } = await req.json();

    if (!skill || typeof skill !== "string") {
      return NextResponse.json({ error: "Missing skill name" }, { status: 400 });
    }
    if (!appName || !machineId) {
      return NextResponse.json({ error: "Missing appName or machineId" }, { status: 400 });
    }

    // Read the local SKILL.md content
    const srcFile = path.join(SKILLS_DIR, skill, "SKILL.md");
    let content: string;
    try {
      content = await fs.readFile(srcFile, "utf-8");
    } catch {
      return NextResponse.json({ error: `Skill "${skill}" not found` }, { status: 404 });
    }

    // Write the file on the remote machine via Fly exec API
    const destDir = `/app/${skill}`;
    const destFile = `${destDir}/SKILL.md`;

    const res = await fetch(
      `${FLY_API_BASE}/apps/${encodeURIComponent(appName)}/machines/${encodeURIComponent(machineId)}/exec`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: ["sh", "-c", `mkdir -p ${destDir} && cat > ${destFile} << 'SKILLEOF'\n${content}\nSKILLEOF`],
          timeout: 30,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Fly.io API error (${res.status}): ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, dest: destFile, exec: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
