-- 6. Backfill existing users who don't have profiles yet (run once)

do $backfill$
declare
  u record;
  new_ws_id uuid;
  user_name text;
  ws_slug text;
begin
  for u in
    select id, email, raw_user_meta_data
    from auth.users
    where id not in (select id from public.profiles)
  loop
    user_name := coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1)
    );
    ws_slug := regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

    while exists (select 1 from public.workspaces where slug = ws_slug) loop
      ws_slug := ws_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    end loop;

    insert into public.workspaces (id, name, slug, is_personal, created_by)
    values (gen_random_uuid(), user_name || '''s Workspace', ws_slug, true, u.id)
    returning id into new_ws_id;

    insert into public.profiles (id, email, full_name, avatar_url, active_workspace_id)
    values (
      u.id,
      u.email,
      user_name,
      u.raw_user_meta_data->>'avatar_url',
      new_ws_id
    );

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_ws_id, u.id, 'owner');
  end loop;
end;
$backfill$;
