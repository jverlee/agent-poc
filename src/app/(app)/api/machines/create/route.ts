import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/supabase/workspaces";
import { registerSSHKey, createDroplet, assignToProject, waitForDropletIp } from "@/lib/digitalocean";
import { checkSSHConnectivity } from "@/lib/ssh";

function readPublicKey(): string {
  const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    throw new Error("SSH_PRIVATE_KEY_PATH is not configured");
  }

  const pubKeyPath = process.env.SSH_PUBLIC_KEY_PATH || `${privateKeyPath}.pub`;
  const resolved = pubKeyPath.startsWith("~")
    ? pubKeyPath.replace("~", process.env.HOME || "/root")
    : resolve(pubKeyPath);

  return readFileSync(resolved, "utf-8").trim();
}

export async function POST(request: NextRequest) {
  const { name, region, size } = await request.json();

  if (!name || !region || !size) {
    return NextResponse.json(
      { error: "name, region, and size are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeWorkspace = await getActiveWorkspace();
  if (!activeWorkspace) {
    return NextResponse.json(
      { error: "No active workspace" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: { step: string; status: string; error?: string; machineId?: string }) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      try {
        // 1. Register SSH key
        send({ step: "ssh_key", status: "in_progress" });
        const publicKey = readPublicKey();
        const sshKeyId = await registerSSHKey(publicKey);
        send({ step: "ssh_key", status: "done" });

        // 2. Create the droplet
        send({ step: "droplet", status: "in_progress" });
        const image = "ubuntu-24-04-x64";
        const droplet = await createDroplet({
          name,
          region,
          size,
          image,
          sshKeyIds: [sshKeyId],
        });
        send({ step: "droplet", status: "done" });

        // 3. Assign to DO project if configured
        const projectId = process.env.DIGITALOCEAN_PROJECT_ID;
        if (projectId) {
          try {
            await assignToProject(projectId, droplet.id);
          } catch (err) {
            console.error("Failed to assign to project:", err);
          }
        }

        // 4. Wait for IP
        send({ step: "ip", status: "in_progress" });
        const publicIp = await waitForDropletIp(droplet.id);
        send({ step: "ip", status: "done" });

        // 5. Save to database (use service client to bypass RLS)
        send({ step: "saving", status: "in_progress" });
        const serviceClient = createServiceClient();
        const { data: machine, error: dbError } = await serviceClient
          .from("machines")
          .insert({
            workspace_id: activeWorkspace.id,
            name,
            ip: publicIp,
            droplet_id: droplet.id,
            region,
            size_slug: size,
            image,
            enabled: true,
            created_by: user.id,
          })
          .select()
          .single();

        if (dbError) {
          send({ step: "saving", status: "error", error: dbError.message });
        } else {
          send({ step: "saving", status: "done" });

          // 6. Wait for SSH connectivity
          send({ step: "ssh", status: "in_progress" });
          let sshReady = false;
          for (let i = 0; i < 20; i++) {
            sshReady = await checkSSHConnectivity(publicIp);
            if (sshReady) break;
            await new Promise((r) => setTimeout(r, 3000));
          }
          if (sshReady) {
            send({ step: "ssh", status: "done" });
          } else {
            send({ step: "ssh", status: "error", error: "SSH connection timed out" });
          }

          send({ step: "complete", status: "done", machineId: machine!.id });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ step: "error", status: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
