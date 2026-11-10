"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

type Photo = { url: string; alt: string | null };

const MAX_SCALE = 4;
const TAP_ZOOM = 2.5;

/**
 * Full-screen product photo viewer (opened from ProductGallery), showing the stored photo itself at full
 * size, not a page-sized copy, so fine detail holds up when zoomed:
 * - phones: pinch to zoom, drag to look around, double-tap to zoom in/out, swipe for the next photo;
 * - computers: scroll wheel or double-click to zoom, drag to look around, arrow keys for the next photo.
 * Closes with ✕ or Esc.
 */
export function ProductZoom({
  photos,
  start,
  title,
  onClose,
}: {
  photos: Photo[];
  start: number;
  title: string;
  onClose: (index: number) => void;
}) {
  const [index, setIndex] = useState(start);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  // while a finger or the mouse is down the photo follows it directly; otherwise zoom steps glide
  const [holding, setHolding] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; mid: { x: number; y: number } } | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const count = photos.length;

  /** Keeps the zoomed photo covering the screen: it can't be dragged past its own edges. */
  const clamp = useCallback((scale: number, x: number, y: number) => {
    const el = stage.current;
    if (!el || scale <= 1) return { scale: Math.max(1, scale), x: 0, y: 0 };
    const maxX = ((scale - 1) * el.clientWidth) / 2;
    const maxY = ((scale - 1) * el.clientHeight) / 2;
    return { scale, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  /** Zoom to `scale` keeping the point under (cx, cy) (screen coordinates) where it is. */
  const zoomAt = useCallback(
    (scale: number, cx: number, cy: number, from = view) => {
      const el = stage.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = cx - (r.left + r.width / 2);
      const py = cy - (r.top + r.height / 2);
      const s = Math.max(1, Math.min(MAX_SCALE, scale));
      const k = s / from.scale;
      setView(clamp(s, px - (px - from.x) * k, py - (py - from.y) * k));
    },
    [clamp, view],
  );

  const go = useCallback(
    (step: number) => {
      setIndex((i) => (i + step + count) % count);
      setView({ scale: 1, x: 0, y: 0 });
    },
    [count],
  );

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(index);
      if (e.key === "ArrowRight" && count > 1) go(1);
      if (e.key === "ArrowLeft" && count > 1) go(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, count, go, onClose]);

  // Wheel zoom (computers). Not a React prop: it must be able to stop the page from scrolling.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => {
        const r = el.getBoundingClientRect();
        const px = e.clientX - (r.left + r.width / 2);
        const py = e.clientY - (r.top + r.height / 2);
        const s = Math.max(1, Math.min(MAX_SCALE, v.scale * Math.exp(-e.deltaY * 0.0025)));
        const k = s / v.scale;
        return clamp(s, px - (px - v.x) * k, py - (py - v.y) * k);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clamp]);

  function onPointerDown(e: ReactPointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setHolding(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale, x: view.x, y: view.y, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      drag.current = null;
    } else if (pointers.current.size === 1) {
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((g.scale * dist) / g.dist, g.mid.x, g.mid.y, { scale: g.scale, x: g.x, y: g.y });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (view.scale > 1) setView(clamp(view.scale, d.vx + dx, d.vy + dy));
  }

  function onPointerUp(e: ReactPointerEvent) {
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size > 0) return;
    setHolding(false);
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    // not zoomed: a sideways swipe moves to the next photo
    if (view.scale === 1 && count > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (d.moved) return;
    // double tap / double click: zoom in at that point, or back out
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (view.scale > 1) setView({ scale: 1, x: 0, y: 0 });
      else zoomAt(TAP_ZOOM, e.clientX, e.clientY);
    } else {
      lastTap.current = now;
    }
  }

  const photo = photos[index];
  const zoomed = view.scale > 1;

  return (
    <div role="dialog" aria-modal="true" aria-label={`${title}: photos`} className="fixed inset-0 z-[70] flex flex-col bg-white motion-safe:animate-fade-in">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-sm text-ink-muted">{count > 1 ? `${index + 1} / ${count}` : ""}</span>
        <span className="hidden text-xs text-ink-muted sm:block">
          {zoomed ? "Drag to look around · double-click to zoom out" : "Scroll or double-click to zoom"}
        </span>
        <span className="text-xs text-ink-muted sm:hidden">{zoomed ? "Drag to look around" : "Pinch or double-tap to zoom"}</span>
        <button
          ref={closeButton}
          type="button"
          onClick={() => onClose(index)}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-line-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div
        ref={stage}
        className={cn("relative min-h-0 flex-1 touch-none select-none overflow-hidden", zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the stored photo at full size, for zooming */}
        <img
          key={photo.url}
          src={photo.url}
          alt={photo.alt ?? title}
          draggable={false}
          className={cn("absolute inset-0 h-full w-full object-contain", !holding && "transition-transform duration-200 ease-out")}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />

        {count > 1 && !zoomed && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow md:flex"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow md:flex"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex shrink-0 justify-center gap-2 py-4">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => {
                setIndex(i);
                setView({ scale: 1, x: 0, y: 0 });
              }}
              aria-label={`Photo ${i + 1}`}
              aria-current={i === index}
              className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-ink" : "w-2 bg-line hover:bg-ink-muted")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
