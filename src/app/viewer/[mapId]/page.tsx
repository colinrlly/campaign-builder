import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Article, Location, Map } from "@/lib/types";
import MapViewer from "@/components/MapViewer";

export const dynamic = "force-dynamic";

export default async function ViewerPage({
  params,
}: {
  params: Promise<{ mapId: string }>;
}) {
  const { mapId } = await params;
  const supabase = await createClient();

  const { data: map } = await supabase
    .from("maps")
    .select("*")
    .eq("id", mapId)
    .single();

  if (!map) notFound();

  const [{ data: locations }, { data: articles }] = await Promise.all([
    supabase.from("locations").select("*").eq("map_id", mapId),
    supabase.from("articles").select("*"),
  ]);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Maps
          </Link>
          <h1 className="text-lg font-semibold">{(map as Map).name}</h1>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <MapViewer
          map={map as Map}
          locations={(locations ?? []) as Location[]}
          articles={(articles ?? []) as Article[]}
        />
      </div>
    </main>
  );
}
