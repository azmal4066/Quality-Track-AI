-- Every user signs up on their own and can use the app immediately.
-- New accounts become 'inspector' (can inspect, add products, manage defects).
-- Admin / super_admin still has to be granted manually.

alter table public.profiles alter column role set default 'inspector';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          'inspector')
  on conflict (id) do nothing;
  return new;
end $$;

-- Users who already signed up as 'viewer' (and could do nothing) become inspectors.
update public.profiles set role = 'inspector' where role = 'viewer';

-- Users created earlier without confirming their email can now log in.
update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;
