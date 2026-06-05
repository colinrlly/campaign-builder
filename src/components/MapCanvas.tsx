"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import type { Box, Location, Map } from "@/lib/types";
import { mapImageUrl } from "@/lib/storage";

type Props = {
  map: Map;
  locations: Location[];
  /** "edit" enables draw-to-create; "view" is read-only/clickable. */
  mode?: "view" | "edit";
  /** In edit mode, whether the draw-new-box surface is active. */
  drawing?: boolean;
  selectedId?: string | null;
  onSelect?: (location: Location) => void;
  onDrawComplete?: (box: Box) => void;
};

/** Clamp a value to the [0, 1] range. */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Build a normalized box from two corner points, with positive w/h. */
function boxFromCorners(ax: number, ay: number, bx: number, by: number): Box {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  };
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
  selectedId = null,
  onSelect,
  onDrawComplete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null);
  const [preview, setPreview] = useState<Box | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const aspect = map.natural_width / map.natural_height;

  // Fit the image inside the available container (contain), recomputing on
  // resize. The frame is sized to the exact rendered image rect so the
  // percentage-positioned overlay always lines up with the image.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw === 0 || ch === 0) return;
      const containerAspect = cw / ch;
      let w: number, h: number;
      if (containerAspect > aspect) {
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

  // Convert a pointer event to normalized [0,1] coords using the frame's live
  // bounding rect, which already reflects the current zoom/pan transform.
  const toNormalized = useCallback((clientX: number, clientY: number) => {
    const rect = frameRef.current!.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drawing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toNormalized(e.clientX, e.clientY);
    dragStart.current = p;
    setPreview({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing || !dragStart.current) return;
    const p = toNormalized(e.clientX, e.clientY);
    setPreview(boxFromCorners(dragStart.current.x, dragStart.current.y, p.x, p.y));
  };

  const onPointerUp = () => {
    if (!drawing || !dragStart.current) return;
    const box = preview;
    dragStart.current = null;
    setPreview(null);
    // Ignore accidental clicks; require a meaningful box.
    if (box && box.w > 0.005 && box.h > 0.005) {
      onDrawComplete?.(box);
    }
  };

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

              {/* Location boxes (clickable when not actively drawing). */}
              <div className="pointer-events-none absolute inset-0">
                {locations.map((loc) => {
                  const active = loc.id === selectedId;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => onSelect?.(loc)}
                      style={{
                        left: `${loc.x * 100}%`,
                        top: `${loc.y * 100}%`,
                        width: `${loc.w * 100}%`,
                        height: `${loc.h * 100}%`,
                      }}
                      className={[
                        "group pointer-events-auto absolute rounded-sm border-2 transition-colors",
                        active
                          ? "border-amber-400 bg-amber-400/25"
                          : "border-sky-400/80 bg-sky-400/10 hover:bg-sky-400/25",
                        drawing ? "pointer-events-none" : "",
                      ].join(" ")}
                      title={loc.label}
                    >
                      <span className="pointer-events-none absolute -top-6 left-0 whitespace-nowrap rounded bg-slate-900/90 px-1.5 py-0.5 text-xs text-slate-100 opacity-0 ring-1 ring-slate-600 transition-opacity group-hover:opacity-100">
                        {loc.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Drawing surface (only in edit mode while drawing). */}
              {drawing && (
                <div
                  className="absolute inset-0 cursor-crosshair"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                >
                  {preview && (
                    <div
                      className="absolute rounded-sm border-2 border-amber-300 bg-amber-300/25"
                      style={{
                        left: `${preview.x * 100}%`,
                        top: `${preview.y * 100}%`,
                        width: `${preview.w * 100}%`,
                        height: `${preview.h * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
