"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import type { Location, Map, Point } from "@/lib/types";
import { mapImageUrl } from "@/lib/storage";

type Props = {
  map: Map;
  locations: Location[];
  /** "edit" enables draw-to-create; "view" is read-only/clickable. */
  mode?: "view" | "edit";
  /** In edit mode, whether the polygon-drawing surface is active. */
  drawing?: boolean;
  /** Hide shape fills/outlines (clickable + hover highlight only). For players. */
  hideShapes?: boolean;
  selectedId?: string | null;
  /** Highlight this location as if hovered (e.g. from an external list). */
  highlightId?: string | null;
  onSelect?: (location: Location) => void;
  onDrawComplete?: (points: Point[]) => void;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Average of the points — good enough for placing a label. */
function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

const ptsToString = (points: Point[]) =>
  points.map((p) => `${p.x},${p.y}`).join(" ");

/** Drop consecutive points that are within epsilon (e.g. a double-click). */
function dedupe(points: Point[], eps = 0.004): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) out.push(p);
  }
  return out;
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const btn =
    "h-9 w-9 rounded-md bg-slate-800/90 text-lg leading-none text-slate-100 ring-1 ring-slate-600 hover:bg-slate-700";
  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-2">
      <button type="button" className={btn} onClick={() => zoomIn()} title="Zoom in">
        +
      </button>
      <button type="button" className={btn} onClick={() => zoomOut()} title="Zoom out">
        −
      </button>
      <button
        type="button"
        className={btn + " text-xs"}
        onClick={() => resetTransform()}
        title="Reset view"
      >
        ⤢
      </button>
    </div>
  );
}

export default function MapCanvas({
  map,
  locations,
  mode = "view",
  drawing = false,
  hideShapes = false,
  selectedId = null,
  highlightId = null,
  onSelect,
  onDrawComplete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // In-progress polygon while drawing.
  const [draft, setDraft] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);

  const aspect = map.natural_width / map.natural_height;

  // Fit the image inside the container (contain), recomputing on resize. The
  // frame is sized to the exact rendered image rect so percentage/normalized
  // overlays always line up with the image.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw === 0 || ch === 0) return;
      let w: number, h: number;
      if (cw / ch > aspect) {
        h = ch;
        w = h * aspect;
      } else {
        w = cw;
        h = w / aspect;
      }
      setFit({ w, h });
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  // Reset the draft whenever drawing is toggled off.
  useEffect(() => {
    if (!drawing) {
      setDraft([]);
      setCursor(null);
    }
  }, [drawing]);

  // Convert a pointer event to normalized [0,1] coords using the frame's live
  // bounding rect, which already reflects the current zoom/pan transform.
  const toNormalized = useCallback((clientX: number, clientY: number): Point => {
    const rect = frameRef.current!.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const finish = useCallback(
    (pts: Point[]) => {
      const clean = dedupe(pts);
      setDraft([]);
      setCursor(null);
      if (clean.length >= 3) onDrawComplete?.(clean);
    },
    [onDrawComplete],
  );

  // Keyboard shortcuts while drawing: Enter closes, Esc cancels, Backspace undo.
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(draft);
      } else if (e.key === "Escape") {
        setDraft([]);
        setCursor(null);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setDraft((d) => d.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, draft, finish]);

  const handleSurfaceClick = (e: React.MouseEvent) => {
    const p = toNormalized(e.clientX, e.clientY);
    // Close if clicking near the first vertex (within ~12px on screen).
    if (draft.length >= 3) {
      const rect = frameRef.current!.getBoundingClientRect();
      const first = draft[0];
      const dpx = Math.hypot(
        (p.x - first.x) * rect.width,
        (p.y - first.y) * rect.height,
      );
      if (dpx < 12) {
        finish(draft);
        return;
      }
    }
    setDraft((d) => [...d, p]);
  };

  const polygonClasses = (loc: Location) => {
    const active = loc.id === selectedId;
    const hovered = loc.id === hoverId || loc.id === highlightId;
    if (active) return { fill: "#fbbf24", fillOpacity: 0.3, stroke: "#fbbf24" };
    if (hovered) return { fill: "#38bdf8", fillOpacity: 0.28, stroke: "#7dd3fc" };
    // Hidden: transparent but still clickable (pointerEvents "all" below).
    if (hideShapes) return { fill: "#38bdf8", fillOpacity: 0, stroke: "transparent" };
    return { fill: "#38bdf8", fillOpacity: 0.12, stroke: "#38bdf8" };
  };

  const labelFor = selectedId ?? hoverId ?? highlightId;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <TransformWrapper
        minScale={0.8}
        maxScale={10}
        limitToBounds={false}
        centerOnInit
        doubleClick={{ disabled: true }}
        panning={{ disabled: drawing }}
        wheel={{ step: 0.12 }}
      >
        <ZoomControls />
        <TransformComponent
          wrapperStyle={{ width: "100%", height: "100%" }}
          contentStyle={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {fit && (
            <div
              ref={frameRef}
              className="relative select-none"
              style={{ width: fit.w, height: fit.h }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapImageUrl(map.image_path)}
                alt={map.name}
                draggable={false}
                className="block h-full w-full"
              />

              {/* SVG overlay: existing polygons + in-progress draft. */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                style={{ pointerEvents: "none", overflow: "visible" }}
              >
                {locations.map((loc) => {
                  if (!loc.points || loc.points.length < 3) return null;
                  const c = polygonClasses(loc);
                  return (
                    <polygon
                      key={loc.id}
                      points={ptsToString(loc.points)}
                      fill={c.fill}
                      fillOpacity={c.fillOpacity}
                      stroke={c.stroke}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        // "all" keeps transparent (hidden) polygons clickable.
                        pointerEvents: drawing ? "none" : "all",
                        cursor: "pointer",
                      }}
                      onClick={() => onSelect?.(loc)}
                      onMouseEnter={() => setHoverId(loc.id)}
                      onMouseLeave={() =>
                        setHoverId((h) => (h === loc.id ? null : h))
                      }
                    />
                  );
                })}

                {/* Drawing surface + draft graphics. */}
                {drawing && (
                  <>
                    <rect
                      x={0}
                      y={0}
                      width={1}
                      height={1}
                      fill="transparent"
                      style={{ pointerEvents: "auto", cursor: "crosshair" }}
                      onClick={handleSurfaceClick}
                      onDoubleClick={() => finish(draft)}
                      onMouseMove={(e) =>
                        setCursor(toNormalized(e.clientX, e.clientY))
                      }
                      onMouseLeave={() => setCursor(null)}
                    />
                    {draft.length > 0 && (
                      <polyline
                        points={ptsToString(
                          cursor ? [...draft, cursor] : draft,
                        )}
                        fill={draft.length >= 3 ? "#fde68a" : "none"}
                        fillOpacity={0.2}
                        stroke="#fbbf24"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </>
                )}
              </svg>

              {/* HTML overlay: draft vertices (crisp, fixed-size dots). */}
              {drawing &&
                draft.map((p, i) => (
                  <div
                    key={i}
                    className={[
                      "pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                      i === 0
                        ? "border-amber-300 bg-amber-300 ring-2 ring-amber-300/40"
                        : "border-amber-400 bg-slate-900",
                    ].join(" ")}
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  />
                ))}

              {/* HTML overlay: label for the hovered/selected location. */}
              {labelFor &&
                (() => {
                  const loc = locations.find((l) => l.id === labelFor);
                  if (!loc || loc.points.length < 3) return null;
                  const c = centroid(loc.points);
                  return (
                    <span
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-slate-900/90 px-1.5 py-0.5 text-xs text-slate-100 ring-1 ring-slate-600"
                      style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                    >
                      {loc.label}
                    </span>
                  );
                })()}
            </div>
          )}
        </TransformComponent>
      </TransformWrapper>

      {drawing && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 ring-1 ring-slate-700">
          Click to add points · click the first point or press Enter to close ·
          Esc to cancel
        </div>
      )}
    </div>
  );
}
