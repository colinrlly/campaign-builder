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
  const [hoverId, setHoverId] = useState<string | null>(null);

  const articleById = useMemo(() => {
    const m = new globalThis.Map<string, Article>();
    for (const a of articles) m.set(a.id, a);
    return m;
  }, [articles]);

  const sorted = useMemo(
    () => [...locations].sort((a, b) => a.label.localeCompare(b.label)),
    [locations],
  );

  const article = selected?.article_id
    ? articleById.get(selected.article_id)
    : undefined;

  return (
    <div className="flex h-full w-full">
      {/* Map */}
      <div className="relative min-w-0 flex-1">
        <MapCanvas
          map={map}
          locations={locations}
          mode="view"
          hideShapes
          selectedId={selected?.id ?? null}
          highlightId={hoverId}
          onSelect={setSelected}
        />
      </div>

      {/* Right panel: location list, or the selected article. */}
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-slate-800 bg-[#0e131d]">
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-800 px-5 py-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                ← All locations
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h2 className="mb-4 text-2xl font-bold">
                {article?.title || selected.label}
              </h2>
              {article && article.body_markdown.trim() ? (
                <MarkdownView markdown={article.body_markdown} />
              ) : (
                <p className="text-slate-500">No lore written yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-800 px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Locations
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {sorted.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">No locations yet.</p>
              ) : (
                <ul>
                  {sorted.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(l)}
                        onMouseEnter={() => setHoverId(l.id)}
                        onMouseLeave={() =>
                          setHoverId((h) => (h === l.id ? null : h))
                        }
                        className="w-full rounded px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                      >
                        {l.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
