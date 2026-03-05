import { getActiveWorkspace } from "@/lib/supabase/workspaces";
import { getWorkspaceMachines } from "@/lib/supabase/machines";
import type { Machine } from "@/lib/supabase/machines";
import HomeContent from "./home-content";

export default async function Home() {
  const activeWorkspace = await getActiveWorkspace();
  const machines: Machine[] = activeWorkspace
    ? await getWorkspaceMachines(activeWorkspace.id)
    : [];

  return <HomeContent machines={machines} />;
}
