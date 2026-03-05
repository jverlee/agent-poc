const DO_API_BASE = "https://api.digitalocean.com/v2";

function getToken(): string {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) throw new Error("DIGITALOCEAN_API_TOKEN is not configured");
  return token;
}

async function doFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${DO_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DigitalOcean API error (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Find a droplet by its public IP address.
 */
export async function getDropletByIp(
  ip: string
): Promise<{ id: number; status: string; size: { slug: string; vcpus: number; memory: number } } | null> {
  const data = await doFetch("/droplets?per_page=200");
  const droplet = data.droplets?.find(
    (d: { networks: { v4: { ip_address: string }[] } }) =>
      d.networks?.v4?.some(
        (n: { ip_address: string }) => n.ip_address === ip
      )
  );
  return droplet || null;
}

/**
 * Delete (destroy) a droplet permanently.
 */
export async function deleteDroplet(dropletId: number): Promise<void> {
  const res = await fetch(`${DO_API_BASE}/droplets/${dropletId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DigitalOcean API error (${res.status}): ${text}`);
  }
}

/**
 * Power cycle (restart) a droplet.
 */
export async function restartDroplet(dropletId: number): Promise<void> {
  await doFetch(`/droplets/${dropletId}/actions`, {
    method: "POST",
    body: JSON.stringify({ type: "power_cycle" }),
  });
}

/**
 * Register an SSH public key with DigitalOcean, or find existing.
 * Returns the SSH key ID.
 */
export async function registerSSHKey(publicKey: string): Promise<number> {
  const keyName = `workmate-${Date.now()}`;

  const res = await fetch(`${DO_API_BASE}/account/keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: keyName, public_key: publicKey }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.ssh_key.id;
  }

  // Key may already exist (fingerprint conflict)
  const errBody = await res.json();
  if (errBody.id === "already_exists" || res.status === 422) {
    const listRes = await fetch(
      `${DO_API_BASE}/account/keys?per_page=200`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    );
    const listData = await listRes.json();
    const existing = listData.ssh_keys?.find(
      (k: { public_key: string }) => k.public_key.trim() === publicKey.trim()
    );
    if (existing) return existing.id;
  }

  throw new Error(`Failed to register SSH key: ${JSON.stringify(errBody)}`);
}

/**
 * Create a DigitalOcean droplet.
 */
export async function createDroplet(params: {
  name: string;
  region: string;
  size: string;
  image: string;
  sshKeyIds: number[];
}): Promise<{ id: number; name: string; networks: { v4: { ip_address: string; type: string }[] } }> {
  const data = await doFetch("/droplets", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      region: params.region,
      size: params.size,
      image: params.image,
      ssh_keys: params.sshKeyIds,
    }),
  });
  return data.droplet;
}

/**
 * Poll a droplet until it has a public IPv4 address.
 * Retries up to maxAttempts times with a delay between each.
 */
export async function waitForDropletIp(
  dropletId: number,
  maxAttempts = 30,
  delayMs = 5000
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await doFetch(`/droplets/${dropletId}`);
    const publicNet = data.droplet?.networks?.v4?.find(
      (n: { type: string }) => n.type === "public"
    );
    if (publicNet?.ip_address) {
      return publicNet.ip_address;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Droplet ${dropletId} did not receive an IP after ${maxAttempts} attempts`);
}

/**
 * Assign a resource to a DigitalOcean project.
 */
export async function assignToProject(
  projectId: string,
  dropletId: number
): Promise<void> {
  await doFetch(`/projects/${projectId}/resources`, {
    method: "POST",
    body: JSON.stringify({
      resources: [`do:droplet:${dropletId}`],
    }),
  });
}
