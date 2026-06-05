import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mapImageUrl } from "@/lib/storage";
import { isOwner } from "@/lib/owner";
import type { Article, Location, Map } from "@/lib/types";
import MapViewer from "@/components/MapViewer";

export const dynamic = "force-dynamic";

const isConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  if (!isConfigured()) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-3xl font-bold">Campaign Builder</h1>
        <p className="mt-4 text-slate-300">
          Set <code className="rounded bg-slate-800 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-slate-800 px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          in <code className="rounded bg-slate-800 px-1">.env.local</code> to get started. See the
          README for setup.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const owner = isOwner(user);
  const preview = (await searchParams).preview === "player";

  // ---- Player view: the map + a location list on the right -----------------
  if (!owner || preview) {
    const { data: maps } = await supabase
      .from("maps")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);
    const map = (maps?.[0] as Map | undefined) ?? null;

    if (!map) {
      return (
        <main className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-2xl font-bold">Campaign Builder</h1>
          <p className="text-slate-400">No maps published yet.</p>
          {preview ? (
            <Link href="/" className="text-sm text-amber-300 underline">
              Exit preview
            </Link>
          ) : (
            !user && (
              <Link href="/login" className="text-sm text-sky-400 underline">
                Sign in
              </Link>
            )
          )}
        </main>
      );
    }

    const [{ data: locations }, { data: articles }] = await Promise.all([
      supabase.from("locations").select("*").eq("map_id", map.id),
      supabase.from("articles").select("*"),
    ]);

    return (
      <main className="flex h-screen flex-col">
        {preview && (
          <div className="flex items-center justify-between bg-amber-500/15 px-4 py-1.5 text-xs text-amber-200 ring-1 ring-amber-500/30">
            <span>Viewing as players</span>
            <Link href="/" className="underline">
              Exit preview
            </Link>
          </div>
        )}
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h1 className="text-lg font-semibold">{map.name}</h1>
          {!user ? (
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Sign in
            </Link>
          ) : owner ? (
            <Link
              href="/editor"
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Editor
            </Link>
          ) : (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Sign out
              </button>
            </form>
          )}
        </header>
        <div className="min-h-0 flex-1">
          <MapViewer
            map={map}
            locations={(locations ?? []) as Location[]}
            articles={(articles ?? []) as Article[]}
          />
        </div>
      </main>
    );
  }

  // ---- Owner dashboard -----------------------------------------------------
  const { data } = await supabase
    .from("maps")
    .select("*")
    .order("created_at", { ascending: false });
  const maps = (data ?? []) as Map[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Campaign Builder</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/?preview=player"
            className="rounded-md px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800"
          >
            View as players
          </Link>
          <Link
            href="/editor"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Editor
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {maps.length === 0 ? (
        <p className="text-slate-400">
          No maps yet. Head to the{" "}
          <Link href="/editor" className="text-sky-400 underline">
            editor
          </Link>{" "}
          to upload your first map.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((map) => (
            <li key={map.id}>
              <Link
                href={`/editor/${map.id}`}
                className="block overflow-hidden rounded-xl ring-1 ring-slate-700 transition hover:ring-sky-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapImageUrl(map.image_path)}
                  alt={map.name}
                  className="aspect-video w-full object-cover"
                />
                <div className="p-3">
                  <h2 className="font-medium">{map.name}</h2>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
