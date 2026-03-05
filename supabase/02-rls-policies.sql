-- 2. RLS Policies

-- profiles
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can read workspace-mate profiles"
  on public.profiles for select
  using (
    id in (
      select wm.user_id from public.workspace_members wm
      where wm.workspace_id in (
        select wm2.workspace_id from public.workspace_members wm2
        where wm2.user_id = auth.uid()
      )
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- workspaces
create policy "Members can read their workspaces"
  on public.workspaces for select
  using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "Authenticated users can create workspaces"
  on public.workspaces for insert
  with check (auth.uid() is not null);

create policy "Owners and admins can update workspaces"
  on public.workspaces for update
  using (
    id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Owners can delete non-personal workspaces"
  on public.workspaces for delete
  using (
    is_personal = false
    and id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- workspace_members
create policy "Members can read workspace memberships"
  on public.workspace_members for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
    )
  );

create policy "Owners and admins can add members"
  on public.workspace_members for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Owners can update member roles"
  on public.workspace_members for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "Owners and admins can remove members"
  on public.workspace_members for delete
  using (
    workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
