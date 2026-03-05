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

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at();

create trigger organization_members_updated_at
  before update on public.organization_members
  for each row execute function public.update_updated_at();
