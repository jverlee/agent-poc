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
 * Power cycle (restart) a droplet.
 */
export async function restartDroplet(dropletId: number): Promise<void> {
  await doFetch(`/droplets/${dropletId}/actions`, {
    method: "POST",
    body: JSON.stringify({ type: "power_cycle" }),
  });
}
