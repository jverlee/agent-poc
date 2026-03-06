export type WorkspaceRole = "owner" | "admin" | "member";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  active_workspace_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  is_personal: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceWithRole {
  workspace: Workspace;
  role: WorkspaceRole;
}

export interface WorkspaceMemberWithProfile {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}
