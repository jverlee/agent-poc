-- 8. Rename organizations → workspaces

-- Rename tables
alter table public.organizations rename to workspaces;
alter table public.organization_members rename to workspace_members;

-- Rename profile column
alter table public.profiles rename column active_organization_id to active_workspace_id;

-- Rename FK constraints
alter table public.profiles rename constraint profiles_active_organization_id_fkey to profiles_active_workspace_id_fkey;

-- Rename indexes
alter index idx_organization_members_user_id rename to idx_workspace_members_user_id;
alter index idx_organization_members_org_id rename to idx_workspace_members_workspace_id;
alter index idx_organizations_slug rename to idx_workspaces_slug;
alter index idx_profiles_active_org rename to idx_profiles_active_workspace;

-- Rename workspace_members columns
alter table public.workspace_members rename column organization_id to workspace_id;

-- Drop all existing RLS policies (must happen before dropping functions they depend on)
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can read org-mate profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

drop policy if exists "Members can read their orgs" on public.workspaces;
drop policy if exists "Authenticated users can create orgs" on public.workspaces;
drop policy if exists "Owners and admins can update orgs" on public.workspaces;
drop policy if exists "Owners can delete non-personal orgs" on public.workspaces;

drop policy if exists "Members can read org memberships" on public.workspace_members;
drop policy if exists "Owners and admins can add members" on public.workspace_members;
drop policy if exists "Owners can update member roles" on public.workspace_members;
drop policy if exists "Owners and admins can remove members" on public.workspace_members;

-- Now safe to drop old helper functions
drop function if exists public.get_user_org_ids(uuid);
drop function if exists public.user_has_org_role(uuid, uuid, text[]);

-- Create new helper functions
create or replace function public.get_user_workspace_ids(uid uuid)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $fn$
  select workspace_id from public.workspace_members where user_id = uid;
$fn$;

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

-- Recreate profiles policies
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can read workspace-mate profiles"
  on public.profiles for select
  using (
    id in (
      select wm.user_id from public.workspace_members wm
      where wm.workspace_id in (select public.get_user_workspace_ids(auth.uid()))
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Recreate workspaces policies
create policy "Members can read their workspaces"
  on public.workspaces for select
  using (id in (select public.get_user_workspace_ids(auth.uid())));

create policy "Authenticated users can create workspaces"
  on public.workspaces for insert
  with check (auth.uid() is not null);

create policy "Owners and admins can update workspaces"
  on public.workspaces for update
  using (public.user_has_workspace_role(auth.uid(), id, array['owner', 'admin']));

create policy "Owners can delete non-personal workspaces"
  on public.workspaces for delete
  using (
    is_personal = false
    and public.user_has_workspace_role(auth.uid(), id, array['owner'])
  );

-- Recreate workspace_members policies
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

-- Rename triggers
alter trigger organizations_updated_at on public.workspaces rename to workspaces_updated_at;
alter trigger organization_members_updated_at on public.workspace_members rename to workspace_members_updated_at;

-- Update handle_new_user trigger function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_new_user$
declare
  new_ws_id uuid;
  user_email text;
  user_name text;
  ws_slug text;
begin
  user_email := new.email;
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)
  );

  ws_slug := regexp_replace(lower(split_part(user_email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

  while exists (select 1 from public.workspaces where slug = ws_slug) loop
    ws_slug := ws_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into public.workspaces (id, name, slug, is_personal, created_by)
  values (gen_random_uuid(), user_name || '''s Workspace', ws_slug, true, new.id)
  returning id into new_ws_id;

  insert into public.profiles (id, email, full_name, avatar_url, active_workspace_id)
  values (
    new.id,
    user_email,
    user_name,
    new.raw_user_meta_data->>'avatar_url',
    new_ws_id
  );

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, new.id, 'owner');

  return new;
end;
$handle_new_user$;

-- Update ensure_user_profile RPC
create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $ensure_profile$
declare
  new_ws_id uuid;
  ws_slug text;
  user_name text;
begin
  if exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  user_name := coalesce(p_full_name, split_part(p_email, '@', 1));
  ws_slug := regexp_replace(lower(split_part(p_email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

  while exists (select 1 from public.workspaces where slug = ws_slug) loop
    ws_slug := ws_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into public.workspaces (id, name, slug, is_personal, created_by)
  values (gen_random_uuid(), user_name || '''s Workspace', ws_slug, true, p_user_id)
  returning id into new_ws_id;

  insert into public.profiles (id, email, full_name, avatar_url, active_workspace_id)
  values (p_user_id, p_email, p_full_name, p_avatar_url, new_ws_id);

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws_id, p_user_id, 'owner');
end;
$ensure_profile$;
