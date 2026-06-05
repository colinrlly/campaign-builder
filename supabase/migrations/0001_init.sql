-- Campaign Builder — initial schema
-- Run this in the Supabase SQL editor (or via the Supabase CLI).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.maps (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  image_path     text not null,          -- key in the `maps` storage bucket
  natural_width  integer not null,       -- pixel dimensions of the uploaded image
  natural_height integer not null,
  created_at     timestamptz not null default now()
);

create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Untitled',
  body_markdown text not null default '',
  updated_at    timestamptz not null default now()
);

create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  map_id     uuid not null references public.maps(id) on delete cascade,
  article_id uuid references public.articles(id) on delete set null,
  label      text not null default 'New location',
  -- Bounding box as fractions of the natural image (each value in [0, 1]).
  x          double precision not null,
  y          double precision not null,
  w          double precision not null,
  h          double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists locations_map_id_idx on public.locations (map_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: public read, authenticated write.
-- ---------------------------------------------------------------------------

alter table public.maps      enable row level security;
alter table public.articles  enable row level security;
alter table public.locations enable row level security;

-- Public (anon) read access so the player-facing viewer works without login.
create policy "public read maps"      on public.maps      for select using (true);
create policy "public read articles"  on public.articles  for select using (true);
create policy "public read locations" on public.locations for select using (true);

-- Only signed-in users (the DM) can create/update/delete.
create policy "auth write maps"      on public.maps      for all to authenticated using (true) with check (true);
create policy "auth write articles"  on public.articles  for all to authenticated using (true) with check (true);
create policy "auth write locations" on public.locations for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for map images: public read, authenticated write.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('maps', 'maps', true)
on conflict (id) do nothing;

create policy "public read map images"
  on storage.objects for select
  using (bucket_id = 'maps');

create policy "auth upload map images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'maps');

create policy "auth update map images"
  on storage.objects for update to authenticated
  using (bucket_id = 'maps');

create policy "auth delete map images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'maps');
