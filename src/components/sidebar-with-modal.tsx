"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { AddMachineModal } from "@/components/add-machine-modal";
import type { Machine } from "@/lib/supabase/machines";

interface SidebarWithModalProps {
  machines: Machine[];
}

export function SidebarWithModal({ machines }: SidebarWithModalProps) {
  const [showAddMachine, setShowAddMachine] = useState(false);

  return (
    <>
      <SidebarNav
        machines={machines}
        onAddMachine={() => setShowAddMachine(true)}
      />
      <AddMachineModal
        open={showAddMachine}
        onClose={() => setShowAddMachine(false)}
      />
    </>
  );
}
