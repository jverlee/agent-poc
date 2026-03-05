-- 4. Auto-create profile + personal org on signup

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_new_user$
declare
  new_org_id uuid;
  user_email text;
  user_name text;
  org_slug text;
begin
  user_email := new.email;
  user_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(user_email, '@', 1)
  );

  org_slug := regexp_replace(lower(split_part(user_email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

  while exists (select 1 from public.organizations where slug = org_slug) loop
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  insert into public.organizations (id, name, slug, is_personal, created_by)
  values (gen_random_uuid(), user_name || '''s Workspace', org_slug, true, new.id)
  returning id into new_org_id;

  insert into public.profiles (id, email, full_name, avatar_url, active_organization_id)
  values (
    new.id,
    user_email,
    user_name,
    new.raw_user_meta_data->>'avatar_url',
    new_org_id
  );

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$handle_new_user$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
