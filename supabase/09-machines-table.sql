-- 9. Machines table — workspace-scoped machines

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  role text,
  ip text,
  droplet_id bigint,
  region text,
  size_slug text,
  image text default 'ubuntu-24-04-x64',
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_machines_workspace_id on public.machines(workspace_id);

alter table public.machines enable row level security;

-- RLS policies
create policy "Workspace members can read machines"
  on public.machines for select
  using (workspace_id in (select public.get_user_workspace_ids(auth.uid())));

create policy "Owners and admins can create machines"
  on public.machines for insert
  with check (public.user_has_workspace_role(auth.uid(), workspace_id, array['owner', 'admin']));

create policy "Owners and admins can update machines"
  on public.machines for update
  using (public.user_has_workspace_role(auth.uid(), workspace_id, array['owner', 'admin']));

create policy "Owners and admins can delete machines"
  on public.machines for delete
  using (public.user_has_workspace_role(auth.uid(), workspace_id, array['owner', 'admin']));

-- Auto-update updated_at
create trigger machines_updated_at
  before update on public.machines
  for each row execute function public.update_updated_at();
