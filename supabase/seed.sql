-- DEMO DATA ONLY. Delete before production use.
insert into public.products (product_code,name,category,description) values
 ('DEMO-001','[DEMO] Aluminium Bracket','Metal parts','Demo product'),
 ('DEMO-002','[DEMO] Circuit Board A1','Electronics','Demo product'),
 ('DEMO-003','[DEMO] Cotton Fabric Roll','Textile','Demo product')
on conflict do nothing;
