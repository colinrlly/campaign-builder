"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAP_BUCKET } from "@/lib/storage";

/** Read an image file's natural pixel dimensions in the browser. */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export default function NewMapForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { width, height } = await readImageSize(file);

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(MAP_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from("maps")
        .insert({
          name: name.trim() || "Untitled map",
          image_path: path,
          natural_width: width,
          natural_height: height,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      router.push(`/editor/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-400">Map name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Reach of Aldermoor"
          className="rounded-md bg-slate-800 px-3 py-2 ring-1 ring-slate-600 outline-none focus:ring-sky-500"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-400">Image (PNG/JPG)</span>
        <input
          type="file"
          accept="image/*"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
        />
      </label>
      <button
        type="submit"
        disabled={busy || !file}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Create map"}
      </button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </form>
  );
}
