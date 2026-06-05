# Campaign Builder

An interactive lore-map tool for tabletop campaigns. Upload a map image (e.g.
an Inkarnate export), draw clickable bounding boxes over locations, and attach
Wikipedia-style markdown articles. Players open the public viewer, click a
location, and the map slides left while the article slides in from the right.

- **Framework:** Next.js (App Router, TypeScript)
- **Database + Auth + Storage:** Supabase
- **Map interaction:** `react-zoom-pan-pinch` with a custom normalized
  bounding-box overlay
- **Articles:** Markdown via `react-markdown` + `remark-gfm`
- **Deploy target:** Vercel

## How coordinates work

Bounding boxes are stored as **fractions of the natural image** (`x, y, w, h`
each in `[0, 1]`) rather than absolute pixels. This keeps every box in the
right place at any zoom level, screen size, or re-export of the same map — as
long as you keep the aspect ratio consistent. The map's natural pixel
dimensions are stored on the `maps` row so the editor and viewer can reason
about the image.

## Setup

### 1. Create a Supabase project

Then run the SQL in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
in the Supabase **SQL Editor**. It creates the `maps`, `articles`, and
`locations` tables, Row Level Security policies (public read, authenticated
write), and a public `maps` storage bucket.

### 2. Configure auth

In **Authentication → Providers → Email**, enable email. Public sign-ups are
fine — your party can create accounts and read the world, but **only the owner
(DM) can edit**. The owner is whoever's email matches `NEXT_PUBLIC_OWNER_EMAIL`
(app) and `public.is_owner()` (database, set in migration `0004`). Everyone
else lands on the player view.

Leave "Confirm email" on if you want confirmation links (handled by
`/auth/confirm`), or off for friction-free sign-ups.

**Two places must agree on the owner email:**
- `NEXT_PUBLIC_OWNER_EMAIL` in your env (app routing/UI).
- the email inside `public.is_owner()` in `supabase/migrations/0004_owner_only_writes.sql` (RLS — the real boundary).

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in from
**Project Settings → API Keys**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Supabase's current key model uses a **publishable** key (`sb_publishable_…`,
the client-side replacement for the legacy anon key) and a **secret** key
(`sb_secret_…`, the replacement for `service_role`). This app uses **only the
publishable key** — it's safe in the browser because all access is enforced by
RLS. Never add the secret key here. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`
name still works as a fallback if your tooling sets it.

### 4. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Go to **Editor**, create your account, upload a
map, and start drawing locations.

## Routes

| Route                | Access     | Purpose                                              |
| -------------------- | ---------- | ---------------------------------------------------- |
| `/`                  | Public     | Player view (latest map + location list) for non-owners; owner dashboard when signed in as the DM. `?preview=player` previews the player view. |
| `/viewer/[mapId]`    | Public     | Player-facing map + article explorer for a specific map |
| `/login`             | Public     | Editor sign in / sign up                             |
| `/editor`            | Protected  | Upload maps, manage list                             |
| `/editor/[mapId]`    | Protected  | Draw polygons, write articles                        |

`/editor/*` is guarded by middleware that redirects signed-out users to
`/login`.

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables.
3. Deploy. (No build config needed — it's a standard Next.js app.)

## Editor usage

1. **Draw location** → click and drag a box over a place on the map.
2. A new location + empty article is created and selected.
3. Set the **label**, **article title**, and write **markdown** lore.
4. **Save**. Use **Preview** to see rendered markdown, or **Preview** in the
   header to open the player viewer.

When you re-export your Inkarnate map with new detail, use **Replace image** in
the editor toolbar: it swaps the image in place and keeps every location.
Because coordinates are normalized, shapes stay aligned as long as the aspect
ratio is unchanged (the editor warns you if a new export changes it).

## Possible next steps

- Move/edit existing polygon vertices (drag handles).
- Reuse one article across multiple locations, or link between articles.
- Per-map article search.
