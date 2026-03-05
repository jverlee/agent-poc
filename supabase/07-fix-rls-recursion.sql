-- Fix infinite recursion in RLS policies.
-- organization_members policies reference organization_members, causing loops.
-- Solution: security definer helper functions that bypass RLS for lookups.

-- Helper: get org IDs for a user (bypasses RLS)
create or replace function public.get_user_org_ids(uid uuid)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $fn$
  select organization_id from public.organization_members where user_id = uid;
$fn$;

-- Helper: check if user has a role in an org (bypasses RLS)
create or replace function public.user_has_org_role(uid uuid, org_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $fn$
  select exists (
    select 1 from public.organization_members
    where user_id = uid
      and organization_id = org_id
      and role = any(allowed_roles)
  );
$fn$;

-- Drop all problematic policies
drop policy if exists "Members can read org memberships" on public.organization_members;
drop policy if exists "Owners and admins can add members" on public.organization_members;
drop policy if exists "Owners can update member roles" on public.organization_members;
drop policy if exists "Owners and admins can remove members" on public.organization_members;
drop policy if exists "Users can read org-mate profiles" on public.profiles;
drop policy if exists "Members can read their orgs" on public.organizations;
drop policy if exists "Owners and admins can update orgs" on public.organizations;
drop policy if exists "Owners can delete non-personal orgs" on public.organizations;

-- organization_members policies (using helper functions)
create policy "Members can read org memberships"
  on public.organization_members for select
  using (organization_id in (select public.get_user_org_ids(auth.uid())));

create policy "Owners and admins can add members"
  on public.organization_members for insert
  with check (public.user_has_org_role(auth.uid(), organization_id, array['owner', 'admin']));

create policy "Owners can update member roles"
  on public.organization_members for update
  using (public.user_has_org_role(auth.uid(), organization_id, array['owner']));

create policy "Owners and admins can remove members"
  on public.organization_members for delete
  using (public.user_has_org_role(auth.uid(), organization_id, array['owner', 'admin']));

-- organizations policies (using helper functions)
create policy "Members can read their orgs"
  on public.organizations for select
  using (id in (select public.get_user_org_ids(auth.uid())));

create policy "Owners and admins can update orgs"
  on public.organizations for update
  using (public.user_has_org_role(auth.uid(), id, array['owner', 'admin']));

create policy "Owners can delete non-personal orgs"
  on public.organizations for delete
  using (
    is_personal = false
    and public.user_has_org_role(auth.uid(), id, array['owner'])
  );

-- profiles: read org-mates (using helper function)
create policy "Users can read org-mate profiles"
  on public.profiles for select
  using (
    id in (
      select om.user_id from public.organization_members om
      where om.organization_id in (select public.get_user_org_ids(auth.uid()))
    )
  );
