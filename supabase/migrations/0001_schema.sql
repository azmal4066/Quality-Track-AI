create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text,
  role text not null default 'viewer' check (role in ('super_admin','admin','inspector','viewer')),
  avatar_url text, is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text unique not null, name text not null, category text,
  description text, image_url text, manufacturing_date date,
  created_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text unique not null,
  product_id uuid references public.products(id) on delete set null,
  total_items integer not null default 0,
  passed_items integer not null default 0,
  failed_items integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  inspector_id uuid references public.profiles(id) on delete set null,
  batch_number text, original_image_url text, annotated_image_url text,
  status text not null check (status in ('PASS','FAIL','REVIEW')),
  quality_score numeric check (quality_score between 0 and 100),
  max_confidence numeric, defect_count integer not null default 0,
  model_version text, notes text,
  created_at timestamptz not null default now()
);

create table public.defects (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  defect_type text not null,
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  confidence numeric, bbox jsonb, description text,
  status text not null default 'open' check (status in ('open','under_review','resolved','closed')),
  corrective_action text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid references public.inspections(id) on delete cascade,
  report_url text, report_type text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null, entity_type text, entity_id uuid,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
insert into public.settings(key,value) values
 ('thresholds','{"pass_max_confidence":0.30,"fail_min_confidence":0.60}'),
 ('defect_categories','["Scratch","Crack","Dent","Surface defect","Discoloration","Missing component"]'),
 ('product_categories','["Electronics","Metal parts","Textile","Packaging"]')
on conflict do nothing;

create index on public.inspections (created_at desc);
create index on public.inspections (product_id);
create index on public.inspections (inspector_id);
create index on public.inspections (batch_number);
create index on public.inspections (status);
create index on public.defects (inspection_id);
create index on public.defects (status);
create index on public.defects (defect_type);
create index on public.audit_logs (created_at desc);

-- New signups are always 'viewer'. Admins promote users afterwards.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
