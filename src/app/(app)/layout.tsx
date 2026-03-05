import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/sidebar-nav";
import { RightSidebar } from "@/components/right-sidebar";
import { StatusProvider } from "@/components/status-provider";
import { LogoutButton } from "@/components/logout-button";
import { OrgSwitcher } from "@/components/org-switcher";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  getUserOrganizations,
  getActiveOrganization,
} from "@/lib/supabase/organizations";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profile, organizations, activeOrg] = await Promise.all([
    getCurrentProfile(),
    getUserOrganizations(),
    getActiveOrganization(),
  ]);

  return (
    <StatusProvider>
      <div className="flex min-h-screen">
        <nav className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-6 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Workmate
          </div>
          {activeOrg && (
            <OrgSwitcher
              organizations={organizations}
              activeOrganization={activeOrg}
            />
          )}
          <Suspense>
            <SidebarNav />
          </Suspense>
          <div className="mt-auto border-t border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                {profile?.full_name ?? user.email}
              </p>
              <LogoutButton />
            </div>
          </div>
        </nav>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
        <RightSidebar />
      </div>
    </StatusProvider>
  );
}
