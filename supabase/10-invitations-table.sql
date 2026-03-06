-- 10. Workspace invitations table

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  unique(workspace_id, email)
);

create index idx_workspace_invitations_token on public.workspace_invitations(token);
create index idx_workspace_invitations_email on public.workspace_invitations(email);
create index idx_workspace_invitations_workspace on public.workspace_invitations(workspace_id);

alter table public.workspace_invitations enable row level security;

-- Workspace owners and admins can manage invitations
create policy "workspace_admins_manage_invitations"
  on public.workspace_invitations
  for all
  using (
    public.user_has_workspace_role(auth.uid(), workspace_id, array['owner', 'admin'])
  )
  with check (
    public.user_has_workspace_role(auth.uid(), workspace_id, array['owner', 'admin'])
  );

-- Users can view invitations sent to their email
create policy "users_view_own_invitations"
  on public.workspace_invitations
  for select
  using (
    email = (auth.jwt() ->> 'email')
  );
