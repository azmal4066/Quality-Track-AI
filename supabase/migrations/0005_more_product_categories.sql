-- Adds more product categories. Keeps any categories already saved (including admin edits) and appends the new ones.
-- Safe to run more than once.
insert into public.settings (key, value)
select 'product_categories', to_jsonb(array_agg(c order by o))
from (
  select c, min(o) as o
  from (
    select e as c, o
    from public.settings s, jsonb_array_elements_text(s.value) with ordinality as t(e, o)
    where s.key = 'product_categories'
    union all
    select d, 1000 + o from unnest(array['Electronics', 'Metal parts', 'Textile', 'Packaging', 'Automotive parts', 'Plastic products', 'Rubber products', 'Glass', 'Ceramics', 'Wood & furniture', 'Paper & printing', 'Food & beverage', 'Pharmaceutical', 'Medical devices', 'Machinery & tools', 'Aerospace components', 'Leather goods', 'Chemicals', 'Construction materials', 'Appliances', 'Semiconductors & PCBs', 'Other']) with ordinality as t(d, o)
  ) u
  group by c
) m
on conflict (key) do update set value = excluded.value, updated_at = now();
