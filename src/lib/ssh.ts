import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function getPrivateKey(): Buffer {
  const keyPath = process.env.SSH_PRIVATE_KEY_PATH;
  if (!keyPath) {
    throw new Error("SSH_PRIVATE_KEY_PATH is not configured");
  }
  const resolved = keyPath.startsWith("~")
    ? keyPath.replace("~", process.env.HOME || "/root")
    : resolve(keyPath);
  return readFileSync(resolved);
}

export function getSSHConfig(ip: string) {
  return {
    host: ip,
    port: 22,
    username: process.env.SSH_USER || "root",
    privateKey: getPrivateKey(),
  };
}

/**
 * Create an SSH connection to the given IP.
 * Returns a connected Client. Caller must close it.
 */
export function createSSHConnection(ip: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on("ready", () => resolve(conn))
      .on("error", (err) => reject(err))
      .connect(getSSHConfig(ip));
  });
}

/**
 * Execute a command on a remote machine via SSH.
 * Returns { stdout, stderr, code }.
 */
export async function execSSHCommand(
  ip: string,
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  const conn = await createSSHConnection(ip);
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        conn.end();
        return reject(err);
      }
      let stdout = "";
      let stderr = "";
      stream
        .on("close", (code: number) => {
          conn.end();
          resolve({ stdout, stderr, code: code ?? 0 });
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString();
        })
        .stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
    });
  });
}

/**
 * Quick SSH connectivity check. Returns true if we can connect.
 */
export async function checkSSHConnectivity(ip: string): Promise<boolean> {
  try {
    const conn = await createSSHConnection(ip);
    conn.end();
    return true;
  } catch {
    return false;
  }
}
