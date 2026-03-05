import { createClient } from "./server";

export interface Machine {
  id: string;
  workspace_id: string;
  name: string;
  role: string | null;
  ip: string | null;
  droplet_id: number | null;
  region: string | null;
  size_slug: string | null;
  image: string | null;
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getWorkspaceMachines(
  workspaceId: string
): Promise<Machine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machines")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) console.error("getWorkspaceMachines error:", error);
  return (data as Machine[]) ?? [];
}

export async function getMachineById(
  machineId: string
): Promise<Machine | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machines")
    .select("*")
    .eq("id", machineId)
    .single();

  if (error) return null;
  return data as Machine;
}

export async function createMachineRecord(machine: {
  workspace_id: string;
  name: string;
  role?: string;
  ip?: string;
  droplet_id?: number;
  region?: string;
  size_slug?: string;
  image?: string;
  created_by: string;
}): Promise<Machine | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("machines")
    .insert(machine)
    .select()
    .single();

  if (error) {
    console.error("createMachineRecord error:", error);
    return null;
  }
  return data as Machine;
}

export async function deleteMachineRecord(
  machineId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("machines")
    .delete()
    .eq("id", machineId);

  return !error;
}
