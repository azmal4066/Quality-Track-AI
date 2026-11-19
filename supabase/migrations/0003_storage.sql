insert into storage.buckets (id, name, public) values
 ('product-images','product-images',false),
 ('inspection-images','inspection-images',false),
 ('annotated-images','annotated-images',false),
 ('reports','reports',false)
on conflict do nothing;

create policy "read private buckets" on storage.objects for select to authenticated
  using (bucket_id in ('product-images','inspection-images','annotated-images','reports')
         and public.current_role_name() is not null);
create policy "staff upload product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff());
-- inspection / annotated / report files are written only by the backend (service role bypasses RLS)
