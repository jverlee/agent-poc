"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationWithRole, Organization } from "@/lib/types/organization";

interface OrgSwitcherProps {
  organizations: OrganizationWithRole[];
  activeOrganization: Organization;
}

export function OrgSwitcher({
  organizations,
  activeOrganization,
}: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function switchOrg(orgId: string) {
    if (orgId === activeOrganization.id) {
      setOpen(false);
      return;
    }

    const res = await fetch("/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: orgId }),
    });

    if (res.ok) {
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  if (organizations.length <= 1) {
    return (
      <div className="px-6 pb-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
        {activeOrganization.name}
      </div>
    );
  }

  return (
    <div className="relative px-6 pb-2" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <span className="truncate">{activeOrganization.name}</span>
        <svg
          className="h-3 w-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute left-6 right-6 top-full z-50 mt-1 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {organizations.map(({ organization, role }) => (
            <button
              key={organization.id}
              onClick={() => switchOrg(organization.id)}
              disabled={isPending}
              className={`flex w-full items-center justify-between px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                organization.id === activeOrganization.id
                  ? "font-medium text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <span className="truncate">{organization.name}</span>
              <span className="ml-2 shrink-0 text-zinc-400">{role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
