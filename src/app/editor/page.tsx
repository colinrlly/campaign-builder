import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mapImageUrl } from "@/lib/storage";
import type { Map } from "@/lib/types";
import NewMapForm from "@/components/NewMapForm";

export const dynamic = "force-dynamic";

export default async function EditorHome() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maps")
    .select("*")
    .order("created_at", { ascending: false });
  const maps = (data ?? []) as Map[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Maps
          </Link>
          <h1 className="text-2xl font-bold">Editor</h1>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md px-3 py-1.5 text-sm text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mb-10 rounded-xl border border-slate-800 p-5">
        <h2 className="mb-3 font-semibold">Upload a new map</h2>
        <NewMapForm />
      </section>

      {maps.length > 0 && (
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
                  <h3 className="font-medium">{map.name}</h3>
                  <p className="text-xs text-slate-500">
                    {map.natural_width}×{map.natural_height}px
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
