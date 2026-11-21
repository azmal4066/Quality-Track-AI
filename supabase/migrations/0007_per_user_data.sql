-- Each user's projects (products, batches, inspections, defects, reports) are private to that user.

-- 1) Owner columns -----------------------------------------------------------
alter table public.products add column if not exists owner_id uuid references public.profiles(id) on delete cascade default auth.uid();
alter table public.batches  add column if not exists owner_id uuid references public.profiles(id) on delete cascade default auth.uid();
alter table public.reports  add column if not exists owner_id uuid references public.profiles(id) on delete cascade default auth.uid();

-- 2) Backfill existing rows (to the first super admin, or the oldest account) ----
do $$
declare first_owner uuid;
begin
  select id into first_owner from public.profiles
   order by (role = 'super_admin') desc, created_at asc limit 1;
  update public.products set owner_id = first_owner where owner_id is null;
  update public.batches  set owner_id = first_owner where owner_id is null;
  update public.inspections set inspector_id = first_owner where inspector_id is null;
  update public.reports r set owner_id = coalesce(
      (select i.inspector_id from public.inspections i where i.id = r.inspection_id), first_owner)
   where r.owner_id is null;
end $$;

-- 3) Codes only need to be unique per user -----------------------------------
alter table public.products drop constraint if exists products_product_code_key;
alter table public.batches  drop constraint if exists batches_batch_number_key;
create unique index if not exists products_owner_code_uq on public.products (owner_id, product_code);
create unique index if not exists batches_owner_number_uq on public.batches (owner_id, batch_number);
create index if not exists products_owner_idx on public.products (owner_id);
create index if not exists reports_owner_idx on public.reports (owner_id);

-- 4) Row Level Security: only the owner ---------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products','batches','inspections','defects','reports'] loop
    execute format('drop policy if exists "%1$s read" on public.%1$s', t);
    execute format('drop policy if exists "%1$s staff insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s staff update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s admin delete" on public.%1$s', t);
  end loop;
end $$;

-- products / batches / reports: owner_id
do $$
declare t text;
begin
  foreach t in array array['products','batches','reports'] loop
    execute format('create policy "%1$s owner read" on public.%1$s for select to authenticated using (owner_id = auth.uid())', t);
    execute format('create policy "%1$s owner insert" on public.%1$s for insert to authenticated with check (owner_id = auth.uid() and public.is_staff())', t);
    execute format('create policy "%1$s owner update" on public.%1$s for update to authenticated using (owner_id = auth.uid() and public.is_staff()) with check (owner_id = auth.uid())', t);
    execute format('create policy "%1$s owner delete" on public.%1$s for delete to authenticated using (owner_id = auth.uid())', t);
  end loop;
end $$;

-- inspections: inspector_id
create policy "inspections owner read" on public.inspections for select to authenticated using (inspector_id = auth.uid());
create policy "inspections owner insert" on public.inspections for insert to authenticated with check (inspector_id = auth.uid() and public.is_staff());
create policy "inspections owner update" on public.inspections for update to authenticated using (inspector_id = auth.uid() and public.is_staff()) with check (inspector_id = auth.uid());
create policy "inspections owner delete" on public.inspections for delete to authenticated using (inspector_id = auth.uid());

-- defects: follow their inspection
create policy "defects owner read" on public.defects for select to authenticated
  using (exists (select 1 from public.inspections i where i.id = inspection_id and i.inspector_id = auth.uid()));
create policy "defects owner insert" on public.defects for insert to authenticated
  with check (public.is_staff() and exists (select 1 from public.inspections i where i.id = inspection_id and i.inspector_id = auth.uid()));
create policy "defects owner update" on public.defects for update to authenticated
  using (public.is_staff() and exists (select 1 from public.inspections i where i.id = inspection_id and i.inspector_id = auth.uid()));
create policy "defects owner delete" on public.defects for delete to authenticated
  using (exists (select 1 from public.inspections i where i.id = inspection_id and i.inspector_id = auth.uid()));

-- profiles: a user only sees their own profile (admins still see everyone for user management)
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- audit logs: each user only reads their own
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit own read" on public.audit_logs for select to authenticated using (user_id = auth.uid());

-- 5) Storage: files readable only by their owner -------------------------------
drop policy if exists "read private buckets" on storage.objects;
drop policy if exists "staff upload product images" on storage.objects;
create policy "read own inspection files" on storage.objects for select to authenticated
  using (bucket_id in ('inspection-images','annotated-images') and exists (
    select 1 from public.inspections i where i.id::text = (storage.foldername(name))[1] and i.inspector_id = auth.uid()));
create policy "read own product images" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and exists (
    select 1 from public.products p where p.id::text = (storage.foldername(name))[1] and p.owner_id = auth.uid()));
-- product images are uploaded through the backend (service role), so no direct upload policy is needed.
