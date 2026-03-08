import { NextRequest, NextResponse } from "next/server";
import { getMachineById } from "@/lib/supabase/machines";
import { createSSHConnection } from "@/lib/ssh";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const machineId = formData.get("machineId") as string;
  const file = formData.get("file") as File | null;

  if (!machineId || !file) {
    return NextResponse.json(
      { error: "machineId and file are required" },
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
    const conn = await createSSHConnection(machine.ip);
    const remotePath = `uploads/${file.name}`;

    // Ensure uploads directory exists
    await new Promise<void>((resolve, reject) => {
      conn.exec("mkdir -p ~/uploads", (err, stream) => {
        if (err) return reject(err);
        stream.on("data", () => {});
        stream.stderr.on("data", () => {});
        stream.on("close", () => resolve());
      });
    });

    // Upload file via SFTP
    const buffer = Buffer.from(await file.arrayBuffer());
    await new Promise<void>((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        const writeStream = sftp.createWriteStream(remotePath);
        writeStream.on("close", () => {
          conn.end();
          resolve();
        });
        writeStream.on("error", (e: Error) => {
          conn.end();
          reject(e);
        });
        writeStream.end(buffer);
      });
    });

    return NextResponse.json({ path: remotePath });
  } catch (err) {
    return NextResponse.json(
      { error: `Upload failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
