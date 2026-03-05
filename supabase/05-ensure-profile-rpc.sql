-- 5. RPC safety net for existing users (called from app code)

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
