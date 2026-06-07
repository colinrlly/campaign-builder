"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAP_BUCKET } from "@/lib/storage";
import { readImageSize } from "@/lib/image";
import type { Article, Location, Map, Point } from "@/lib/types";
import MapCanvas from "./MapCanvas";
import MarkdownView from "./MarkdownView";

type Props = {
  map: Map;
  initialLocations: Location[];
  initialArticles: Article[];
};

export default function MapEditor({
  map,
  initialLocations,
  initialArticles,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [articles, setArticles] = useState<Record<string, Article>>(() =>
    Object.fromEntries(initialArticles.map((a) => [a.id, a])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Image is replaceable in place; locations are kept (normalized coords).
  const [image, setImage] = useState({
    image_path: map.image_path,
    natural_width: map.natural_width,
    natural_height: map.natural_height,
  });
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Draft fields for the currently selected location/article.
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");

  const selected = locations.find((l) => l.id === selectedId) ?? null;
  const selectedArticle = selected?.article_id
    ? articles[selected.article_id]
    : undefined;

  // Sync drafts when the selection changes.
  useEffect(() => {
    if (!selected) return;
    setLabel(selected.label);
    setTitle(selectedArticle?.title ?? "");
    setBody(selectedArticle?.body_markdown ?? "");
    setTab("write");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Unsaved-changes tracking for the selected article (geometry auto-saves and
  // is not counted here).
  const dirty =
    !!selected &&
    (label !== selected.label ||
      title !== (selectedArticle?.title ?? "") ||
      body !== (selectedArticle?.body_markdown ?? ""));

  // Warn on tab close / refresh / full navigation while there are edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Guard in-editor selection changes so edits aren't silently lost.
  function selectLocation(id: string | null) {
    if (id === selectedId) return;
    if (
      dirty &&
      !window.confirm(
        "You have unsaved changes to this article. Leave without saving?",
      )
    ) {
      return;
    }
    setSelectedId(id);
  }

  async function handleDraw(points: Point[]) {
    setStatus("Creating…");
    // Each location gets its own article (1:1).
    const { data: article, error: aErr } = await supabase
      .from("articles")
      .insert({ title: "Untitled", body_markdown: "" })
      .select("*")
      .single();
    if (aErr || !article) {
      setStatus(`Error: ${aErr?.message}`);
      return;
    }

    const { data: loc, error: lErr } = await supabase
      .from("locations")
      .insert({
        map_id: map.id,
        article_id: article.id,
        label: "New location",
        points,
      })
      .select("*")
      .single();
    if (lErr || !loc) {
      setStatus(`Error: ${lErr?.message}`);
      return;
    }

    setArticles((m) => ({ ...m, [article.id]: article as Article }));
    setLocations((ls) => [...ls, loc as Location]);
    setSelectedId((loc as Location).id);
    setDrawing(false);
    setStatus(null);
  }

  async function handleReplaceImage(file: File) {
    setStatus("Uploading new image…");
    try {
      const { width, height } = await readImageSize(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(MAP_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw new Error(`Image upload: ${upErr.message}`);

      const { error: updErr } = await supabase
        .from("maps")
        .update({
          image_path: path,
          natural_width: width,
          natural_height: height,
        })
        .eq("id", map.id);
      if (updErr) throw new Error(`Update map: ${updErr.message}`);

      const oldPath = image.image_path;
      const aspectChanged =
        Math.abs(
          width / height - image.natural_width / image.natural_height,
        ) > 0.01;

      setImage({ image_path: path, natural_width: width, natural_height: height });

      // Best-effort cleanup of the previous image.
      if (oldPath && oldPath !== path) {
        await supabase.storage.from(MAP_BUCKET).remove([oldPath]);
      }

      setStatus(
        aspectChanged
          ? "Replaced — aspect ratio changed, existing shapes may shift."
          : "Image replaced ✓",
      );
      setTimeout(() => setStatus(null), aspectChanged ? 6000 : 2000);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Replace failed");
    } finally {
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  }

  // Live geometry update while dragging a vertex/shape (local only).
  function handlePointsChange(id: string, points: Point[]) {
    setLocations((ls) => ls.map((l) => (l.id === id ? { ...l, points } : l)));
  }

  // Persist a geometry change (vertex drop, add, delete, move).
  async function handlePointsCommit(id: string, points: Point[]) {
    setLocations((ls) => ls.map((l) => (l.id === id ? { ...l, points } : l)));
    const { error } = await supabase
      .from("locations")
      .update({ points })
      .eq("id", id);
    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus("Shape saved ✓");
      setTimeout(() => setStatus(null), 1200);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setStatus("Saving…");

    const { error: lErr } = await supabase
      .from("locations")
      .update({ label })
      .eq("id", selected.id);
    if (lErr) {
      setStatus(`Error: ${lErr.message}`);
      return;
    }
    setLocations((ls) =>
      ls.map((l) => (l.id === selected.id ? { ...l, label } : l)),
    );

    if (selected.article_id) {
      const { data: updated, error: aErr } = await supabase
        .from("articles")
        .update({
          title,
          body_markdown: body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.article_id)
        .select("*")
        .single();
      if (aErr) {
        setStatus(`Error: ${aErr.message}`);
        return;
      }
      setArticles((m) => ({ ...m, [selected.article_id!]: updated as Article }));
    }

    setStatus("Saved ✓");
    setTimeout(() => setStatus(null), 1500);
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm(`Delete "${selected.label}" and its article?`)) return;

    await supabase.from("locations").delete().eq("id", selected.id);
    if (selected.article_id) {
      await supabase.from("articles").delete().eq("id", selected.article_id);
    }
    setLocations((ls) => ls.filter((l) => l.id !== selected.id));
    setSelectedId(null);
  }

  return (
    <div className="flex h-full w-full">
      {/* Map + toolbar */}
      <div className="relative min-w-0 flex-1">
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawing((d) => !d)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium ring-1 transition",
              drawing
                ? "bg-amber-500 text-slate-900 ring-amber-400"
                : "bg-slate-800/90 text-slate-100 ring-slate-600 hover:bg-slate-700",
            ].join(" ")}
          >
            {drawing ? "Drawing… (click points)" : "Draw location"}
          </button>
          <button
            type="button"
            onClick={() => replaceInputRef.current?.click()}
            className="rounded-md bg-slate-800/90 px-3 py-1.5 text-sm font-medium text-slate-100 ring-1 ring-slate-600 transition hover:bg-slate-700"
            title="Replace the map image (keeps all locations)"
          >
            Replace image
          </button>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleReplaceImage(file);
            }}
          />
          {status && (
            <span className="rounded bg-slate-900/90 px-2 py-1 text-xs text-slate-300 ring-1 ring-slate-700">
              {status}
            </span>
          )}
        </div>
        <MapCanvas
          map={{ ...map, ...image }}
          locations={locations}
          mode="edit"
          drawing={drawing}
          editable
          selectedId={selectedId}
          onSelect={(loc) => selectLocation(loc.id)}
          onDrawComplete={handleDraw}
          onPointsChange={handlePointsChange}
          onPointsCommit={handlePointsCommit}
        />
      </div>

      {/* Inspector */}
      <aside className="h-full w-[420px] shrink-0 overflow-y-auto border-l border-slate-800 bg-[#0e131d]">
        {!selected ? (
          <div className="p-6 text-sm text-slate-400">
            <p className="font-medium text-slate-200">No location selected</p>
            <p className="mt-2">
              Click <strong>Draw location</strong>, then click points around a
              place to outline it; click the first point (or press Enter) to
              close the shape. Or click an existing shape to edit it.
            </p>
            {locations.length > 0 && (
              <ul className="mt-5 space-y-1">
                {locations.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => selectLocation(l.id)}
                      className="w-full rounded px-2 py-1 text-left text-slate-300 hover:bg-slate-800"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col p-5">
            <p className="mb-3 rounded bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
              Drag a point to reshape · drag the shape to move · click a midpoint
              to add a point · double-click a point to delete. Changes save
              automatically.
            </p>
            <label className="mb-3 flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Location label</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="rounded-md bg-slate-800 px-3 py-2 ring-1 ring-slate-600 outline-none focus:ring-sky-500"
              />
            </label>

            <label className="mb-3 flex flex-col gap-1 text-sm">
              <span className="text-slate-400">Article title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-md bg-slate-800 px-3 py-2 ring-1 ring-slate-600 outline-none focus:ring-sky-500"
              />
            </label>

            <div className="mb-1 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setTab("write")}
                className={`rounded px-2 py-1 ${tab === "write" ? "bg-slate-700 text-white" : "text-slate-400"}`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`rounded px-2 py-1 ${tab === "preview" ? "bg-slate-700 text-white" : "text-slate-400"}`}
              >
                Preview
              </button>
              <span className="ml-auto text-slate-500">Markdown</span>
            </div>

            {tab === "write" ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="# Lore&#10;&#10;Write the story of this place in **markdown**…"
                className="min-h-[260px] flex-1 resize-none rounded-md bg-slate-800 px-3 py-2 font-mono text-sm ring-1 ring-slate-600 outline-none focus:ring-sky-500"
              />
            ) : (
              <div className="min-h-[260px] flex-1 overflow-y-auto rounded-md bg-slate-900/60 px-4 py-3 ring-1 ring-slate-700">
                {body.trim() ? (
                  <MarkdownView markdown={body} />
                ) : (
                  <p className="text-slate-500">Nothing to preview.</p>
                )}
              </div>
            )}

            {dirty && (
              <p className="mt-3 text-xs text-amber-300">● Unsaved changes</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => selectLocation(null)}
                className="rounded-md px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="ml-auto rounded-md px-3 py-2 text-sm text-rose-400 ring-1 ring-rose-900/60 hover:bg-rose-950/40"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
