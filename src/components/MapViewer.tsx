"use client";

import { useMemo, useState } from "react";
import type { Article, Location, Map } from "@/lib/types";
import MapCanvas from "./MapCanvas";
import MarkdownView from "./MarkdownView";

type Props = {
  map: Map;
  locations: Location[];
  articles: Article[];
};

export default function MapViewer({ map, locations, articles }: Props) {
  const [selected, setSelected] = useState<Location | null>(null);

  const articleById = useMemo(() => {
    const m = new globalThis.Map<string, Article>();
    for (const a of articles) m.set(a.id, a);
    return m;
  }, [articles]);

  const article = selected?.article_id
    ? articleById.get(selected.article_id)
    : undefined;
  const open = Boolean(selected);

  return (
    <div className="flex h-full w-full">
      {/* Map area shrinks (shifts left) when an article opens. */}
      <div className="relative min-w-0 flex-1 transition-all duration-500">
        <MapCanvas
          map={map}
          locations={locations}
          mode="view"
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      </div>

      {/* Article panel slides in from the right. */}
      <aside
        className="h-full shrink-0 overflow-hidden border-l border-slate-800 bg-[#0e131d] transition-all duration-500 ease-out"
        style={{ width: open ? "min(40vw, 560px)" : 0 }}
      >
        <div
          className="h-full overflow-y-auto"
          style={{ width: "min(40vw, 560px)" }}
        >
          {selected && (
            <div className="px-7 py-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-2xl font-bold">
                  {article?.title || selected.label}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="shrink-0 rounded-md px-2 py-1 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-800"
                  title="Close"
                >
                  ✕
                </button>
              </div>
              {article && article.body_markdown.trim() ? (
                <MarkdownView markdown={article.body_markdown} />
              ) : (
                <p className="text-slate-500">No lore written yet.</p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
