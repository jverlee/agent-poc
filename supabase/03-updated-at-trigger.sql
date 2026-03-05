-- 3. Auto-update updated_at trigger

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $update_at$
begin
  new.updated_at = now();
  return new;
end;
$update_at$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.update_updated_at();

create trigger workspace_members_updated_at
  before update on public.workspace_members
  for each row execute function public.update_updated_at();
