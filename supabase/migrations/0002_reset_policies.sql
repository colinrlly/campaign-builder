-- Idempotent re-create of all RLS policies (tables + storage).
-- Safe to run multiple times. Use this if uploads/inserts fail with
-- "new row violates row-level security policy".

-- Make sure RLS is on.
alter table public.maps      enable row level security;
alter table public.articles  enable row level security;
alter table public.locations enable row level security;

-- ---- Tables: public read, authenticated write -----------------------------
drop policy if exists "public read maps"      on public.maps;
drop policy if exists "public read articles"  on public.articles;
drop policy if exists "public read locations" on public.locations;
drop policy if exists "auth write maps"       on public.maps;
drop policy if exists "auth write articles"   on public.articles;
drop policy if exists "auth write locations"  on public.locations;

create policy "public read maps"      on public.maps      for select using (true);
create policy "public read articles"  on public.articles  for select using (true);
create policy "public read locations" on public.locations for select using (true);

create policy "auth write maps"      on public.maps      for all to authenticated using (true) with check (true);
create policy "auth write articles"  on public.articles  for all to authenticated using (true) with check (true);
create policy "auth write locations" on public.locations for all to authenticated using (true) with check (true);

-- ---- Storage bucket: public read, authenticated write ----------------------
insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do update set public = true;

drop policy if exists "public read map images" on storage.objects;
drop policy if exists "auth upload map images" on storage.objects;
drop policy if exists "auth update map images" on storage.objects;
drop policy if exists "auth delete map images" on storage.objects;

create policy "public read map images"
  on storage.objects for select using (bucket_id = 'maps');
create policy "auth upload map images"
  on storage.objects for insert to authenticated with check (bucket_id = 'maps');
create policy "auth update map images"
  on storage.objects for update to authenticated using (bucket_id = 'maps');
create policy "auth delete map images"
  on storage.objects for delete to authenticated using (bucket_id = 'maps');

-- ---- Verify: expect 6 table policies + 4 storage "map images" policies -----
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where (schemaname = 'public' and tablename in ('maps', 'articles', 'locations'))
   or (schemaname = 'storage' and tablename = 'objects' and policyname like '%map images%')
order by schemaname, tablename, policyname;
