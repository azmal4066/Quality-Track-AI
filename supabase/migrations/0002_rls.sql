create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() and is_active $$;

create or replace function public.is_staff() returns boolean language sql stable as
$$ select public.current_role_name() in ('super_admin','admin','inspector') $$;
create or replace function public.is_admin() returns boolean language sql stable as
$$ select public.current_role_name() in ('super_admin','admin') $$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.batches enable row level security;
alter table public.inspections enable row level security;
alter table public.defects enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles admin update" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['products','batches','inspections','defects','reports'] loop
    execute format('create policy "%1$s read" on public.%1$s for select to authenticated using (public.current_role_name() is not null)', t);
    execute format('create policy "%1$s staff insert" on public.%1$s for insert to authenticated with check (public.is_staff())', t);
    execute format('create policy "%1$s staff update" on public.%1$s for update to authenticated using (public.is_staff())', t);
    execute format('create policy "%1$s admin delete" on public.%1$s for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

create policy "audit admin read" on public.audit_logs for select to authenticated using (public.is_admin());
create policy "audit insert" on public.audit_logs for insert to authenticated with check (user_id = auth.uid());
create policy "settings read" on public.settings for select to authenticated using (true);
create policy "settings admin write" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
