-- Fix infinite recursion in RLS policies.
-- workspace_members policies reference workspace_members, causing loops.
-- Solution: security definer helper functions that bypass RLS for lookups.

-- Helper: get workspace IDs for a user (bypasses RLS)
create or replace function public.get_user_workspace_ids(uid uuid)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $fn$
  select workspace_id from public.workspace_members where user_id = uid;
$fn$;

-- Helper: check if user has a role in a workspace (bypasses RLS)
create or replace function public.user_has_workspace_role(uid uuid, ws_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $fn$
  select exists (
    select 1 from public.workspace_members
    where user_id = uid
      and workspace_id = ws_id
      and role = any(allowed_roles)
  );
$fn$;

-- Drop all problematic policies
drop policy if exists "Members can read workspace memberships" on public.workspace_members;
drop policy if exists "Owners and admins can add members" on public.workspace_members;
drop policy if exists "Owners can update member roles" on public.workspace_members;
drop policy if exists "Owners and admins can remove members" on public.workspace_members;
drop policy if exists "Users can read workspace-mate profiles" on public.profiles;
drop policy if exists "Members can read their workspaces" on public.workspaces;
drop policy if exists "Owners and admins can update workspaces" on public.workspaces;
drop policy if exists "Owners can delete non-personal workspaces" on public.workspaces;

-- workspace_members policies (using helper functions)
create policy "Members can read workspace memberships"
  on public.workspace_members for select
  using (workspace_id in (select public.get_user_workspace_ids(auth.uid())));

create policy "Owners and admins can add members"
  on public.workspace_members for insert
  with check (public.user_has_workspace_role(auth.uid(), workspace_id, array['owner', 'admin']));

create policy "Owners can update member roles"
  on public.workspace_members for update
  using (public.user_has_workspace_role(auth.uid(), workspace_id, array['owner']));

create policy "Owners and admins can remove members"
  on public.workspace_members for delete
  using (public.user_has_workspace_role(auth.uid(), workspace_id, array['owner', 'admin']));

-- workspaces policies (using helper functions)
create policy "Members can read their workspaces"
  on public.workspaces for select
  using (id in (select public.get_user_workspace_ids(auth.uid())));

create policy "Owners and admins can update workspaces"
  on public.workspaces for update
  using (public.user_has_workspace_role(auth.uid(), id, array['owner', 'admin']));

create policy "Owners can delete non-personal workspaces"
  on public.workspaces for delete
  using (
    is_personal = false
    and public.user_has_workspace_role(auth.uid(), id, array['owner'])
  );

-- profiles: read workspace-mates (using helper function)
create policy "Users can read workspace-mate profiles"
  on public.profiles for select
  using (
    id in (
      select wm.user_id from public.workspace_members wm
      where wm.workspace_id in (select public.get_user_workspace_ids(auth.uid()))
    )
  );
