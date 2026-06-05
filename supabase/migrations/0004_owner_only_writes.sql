-- Restrict all writes to the owner (DM). Public sign-ups are fine: party
-- members can have accounts and read everything, but only the owner can edit.
-- This is the real security boundary (the app routing mirrors it).
--
-- Run in the Supabase SQL editor. EDIT THE EMAIL BELOW to match your account,
-- then keep NEXT_PUBLIC_OWNER_EMAIL set to the same value in the app.

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(auth.email() = 'colinrlly@gmail.com', false)
$$;

-- ---- Tables: public read stays; writes become owner-only -------------------
drop policy if exists "auth write maps"      on public.maps;
drop policy if exists "auth write articles"  on public.articles;
drop policy if exists "auth write locations" on public.locations;

create policy "owner write maps"      on public.maps      for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner write articles"  on public.articles  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner write locations" on public.locations for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ---- Storage: public read stays; uploads/changes become owner-only ---------
drop policy if exists "auth upload map images" on storage.objects;
drop policy if exists "auth update map images" on storage.objects;
drop policy if exists "auth delete map images" on storage.objects;

create policy "owner upload map images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'maps' and public.is_owner());

create policy "owner update map images"
  on storage.objects for update to authenticated
  using (bucket_id = 'maps' and public.is_owner());

create policy "owner delete map images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'maps' and public.is_owner());

-- Verify: write policies should now reference is_owner(); reads stay public.
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where (schemaname = 'public' and tablename in ('maps', 'articles', 'locations'))
   or (schemaname = 'storage' and tablename = 'objects' and policyname like '%map images%')
order by schemaname, tablename, policyname;
