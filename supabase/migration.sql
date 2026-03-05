-- =============================================================================
-- Organization Structure Migration
-- Run this in the Supabase Dashboard SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  is_personal boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  active_organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- FK from profiles to organizations (added after both tables exist)
alter table public.profiles
  add constraint profiles_active_organization_id_fkey
  foreign key (active_organization_id)
  references public.organizations(id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- 2. Indexes
-- -----------------------------------------------------------------------------

create index idx_organization_members_user_id on public.organization_members(user_id);
create index idx_organization_members_org_id on public.organization_members(organization_id);
create index idx_organizations_slug on public.organizations(slug);
create index idx_profiles_active_org on public.profiles(active_organization_id);

-- -----------------------------------------------------------------------------
-- 3. Enable RLS
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- -----------------------------------------------------------------------------
-- 4. RLS Policies — profiles
-- -----------------------------------------------------------------------------

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can read org-mate profiles"
  on public.profiles for select
  using (
    id in (
      select om.user_id from public.organization_members om
      where om.organization_id in (
        select om2.organization_id from public.organization_members om2
        where om2.user_id = auth.uid()
      )
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 5. RLS Policies — organizations
-- -----------------------------------------------------------------------------

create policy "Members can read their orgs"
  on public.organizations for select
  using (
    id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Authenticated users can create orgs"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "Owners and admins can update orgs"
  on public.organizations for update
  using (
    id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Owners can delete non-personal orgs"
  on public.organizations for delete
  using (
    is_personal = false
    and id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- -----------------------------------------------------------------------------
-- 6. RLS Policies — organization_members
-- -----------------------------------------------------------------------------

create policy "Members can read org memberships"
  on public.organization_members for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Owners and admins can add members"
  on public.organization_members for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Owners can update member roles"
  on public.organization_members for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "Owners and admins can remove members"
  on public.organization_members for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Auto-update updated_at trigger
-- -----------------------------------------------------------------------------

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at();

create trigger organization_members_updated_at
  before update on public.organization_members
  for each row execute function public.update_updated_at();

-- -----------------------------------------------------------------------------
-- 8. Auto-create profile + personal org on signup
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  -- Generate slug from email prefix
  org_slug := regexp_replace(lower(split_part(user_email, '@', 1)), '[^a-z0-9]', '-', 'g') || '-personal';

  -- Ensure slug uniqueness
  while exists (select 1 from public.organizations where slug = org_slug) loop
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  end loop;

  -- Create personal organization
  insert into public.organizations (id, name, slug, is_personal, created_by)
  values (gen_random_uuid(), user_name || '''s Workspace', org_slug, true, new.id)
  returning id into new_org_id;

  -- Create profile
  insert into public.profiles (id, email, full_name, avatar_url, active_organization_id)
  values (
    new.id,
    user_email,
    user_name,
    new.raw_user_meta_data->>'avatar_url',
    new_org_id
  );

  -- Add user as owner of their personal org
  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 9. RPC safety net for existing users (called from app code)
-- -----------------------------------------------------------------------------

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
as $$
declare
  new_org_id uuid;
  org_slug text;
  user_name text;
begin
  -- Exit if profile already exists
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
$$;

-- -----------------------------------------------------------------------------
-- 10. Backfill existing users (run once after deploying the above)
-- -----------------------------------------------------------------------------

do $$
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
$$;
