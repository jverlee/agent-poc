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
  new_org_id uuid;
  org_slug text;
  user_name text;
begin
  if exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  user_name := coalesce(p_full_name, split_part(p_email, '@', 1));
  org_slug := regexp_replace(lower(split_part(p_email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

  while exists (select 1 from public.organizations where slug = org_slug) loop
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into public.organizations (id, name, slug, is_personal, created_by)
  values (gen_random_uuid(), user_name || '''s Workspace', org_slug, true, p_user_id)
  returning id into new_org_id;

  insert into public.profiles (id, email, full_name, avatar_url, active_organization_id)
  values (p_user_id, p_email, p_full_name, p_avatar_url, new_org_id);

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, p_user_id, 'owner');
end;
$ensure_profile$;
