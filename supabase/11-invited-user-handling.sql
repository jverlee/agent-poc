-- 11. Updated handle_new_user to check for pending invitations
-- If a new user has pending invitations, add them to those workspaces
-- and do NOT create a personal workspace.

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
  inv record;
  has_invitations boolean := false;
  first_workspace_id uuid;
begin
  user_email := new.email;
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)
  );

  -- Check for pending invitations
  for inv in
    select id, workspace_id, role
    from public.workspace_invitations
    where email = user_email
      and status = 'pending'
      and expires_at > now()
  loop
    has_invitations := true;

    -- Add user to the workspace
    insert into public.workspace_members (workspace_id, user_id, role)
    values (inv.workspace_id, new.id, inv.role)
    on conflict do nothing;

    -- Mark invitation as accepted
    update public.workspace_invitations
    set status = 'accepted'
    where id = inv.id;

    -- Track first workspace for setting as active
    if first_workspace_id is null then
      first_workspace_id := inv.workspace_id;
    end if;
  end loop;

  if has_invitations then
    -- Create profile with first invited workspace as active
    insert into public.profiles (id, email, full_name, avatar_url, active_workspace_id)
    values (
      new.id,
      user_email,
      user_name,
      new.raw_user_meta_data->>'avatar_url',
      first_workspace_id
    );
  else
    -- No invitations — create personal workspace as before
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
  end if;

  return new;
end;
$handle_new_user$;
