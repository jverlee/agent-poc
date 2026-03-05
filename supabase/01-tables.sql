-- 1. Tables, FK, Indexes, RLS enable

create table public.workspaces (
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
  active_workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.profiles
  add constraint profiles_active_workspace_id_fkey
  foreign key (active_workspace_id)
  references public.workspaces(id)
  on delete set null;

create index idx_workspace_members_user_id on public.workspace_members(user_id);
create index idx_workspace_members_workspace_id on public.workspace_members(workspace_id);
create index idx_workspaces_slug on public.workspaces(slug);
create index idx_profiles_active_workspace on public.profiles(active_workspace_id);

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
