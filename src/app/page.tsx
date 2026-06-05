import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mapImageUrl } from "@/lib/storage";
import type { Map } from "@/lib/types";

export const dynamic = "force-dynamic";

const isConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

export default async function Home() {
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
  const { data } = await supabase
    .from("maps")
    .select("*")
    .order("created_at", { ascending: false });
  const maps = (data ?? []) as Map[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Campaign Builder</h1>
        <Link
          href="/editor"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Editor
        </Link>
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
                href={`/viewer/${map.id}`}
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
