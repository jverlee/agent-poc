-- 6. Backfill existing users who don't have profiles yet (run once)

do $backfill$
declare
  u record;
  new_org_id uuid;
  user_name text;
  org_slug text;
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
    org_slug := regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

    while exists (select 1 from public.organizations where slug = org_slug) loop
      org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
    end loop;

    insert into public.organizations (id, name, slug, is_personal, created_by)
    values (gen_random_uuid(), user_name || '''s Workspace', org_slug, true, u.id)
    returning id into new_org_id;

    insert into public.profiles (id, email, full_name, avatar_url, active_organization_id)
    values (
      u.id,
      u.email,
      user_name,
      u.raw_user_meta_data->>'avatar_url',
      new_org_id
    );

    insert into public.organization_members (organization_id, user_id, role)
    values (new_org_id, u.id, 'owner');
  end loop;
end;
$backfill$;
