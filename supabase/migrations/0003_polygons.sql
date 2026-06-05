-- Move locations from bounding boxes to polygons.
-- Run in the Supabase SQL editor. Safe to run once.

-- 1. Add the polygon column (array of {x, y} points, normalized to [0,1]).
alter table public.locations
  add column if not exists points jsonb not null default '[]'::jsonb;

-- 2. Convert any existing box (x, y, w, h) into a 4-point polygon.
update public.locations
set points = jsonb_build_array(
  jsonb_build_object('x', x,       'y', y),
  jsonb_build_object('x', x + w,   'y', y),
  jsonb_build_object('x', x + w,   'y', y + h),
  jsonb_build_object('x', x,       'y', y + h)
)
where points = '[]'::jsonb
  and x is not null and y is not null and w is not null and h is not null;

-- 3. Drop the old box columns.
alter table public.locations drop column if exists x;
alter table public.locations drop column if exists y;
alter table public.locations drop column if exists w;
alter table public.locations drop column if exists h;

-- Verify: each location should now have a non-empty points array.
select id, label, jsonb_array_length(points) as vertices from public.locations;
