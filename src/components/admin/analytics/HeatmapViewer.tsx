"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { HeatmapData } from "@/lib/analytics/heatmap";

/**
 * Admin → Analytics → Heatmaps: the live shop page in a frame, at the width of the chosen device, with where
 * shoppers clicked (click map) or how far down they got (scroll map) drawn over it. Clicks are placed on the
 * element that was clicked, so they stay in the right place when the page changes a little.
 * The words-only version is the "Most clicked" list beside it.
 */
type Device = "desktop" | "tablet" | "mobile";
type Mode = "clicks" | "scroll";

const WIDTHS: Record<Device, number> = { desktop: 1366, tablet: 820, mobile: 390 };
const VIEW_HEIGHT = 720;
const count = new Intl.NumberFormat("en-PK");

/** Sequential warm ramp for click density: light amber → orange → deep red (one hue family, light to dark). */
const RAMP: [number, number, number][] = [
  [253, 214, 160],
  [245, 160, 90],
  [235, 104, 52],
  [196, 52, 32],
  [140, 20, 24],
];
const PALETTE = (() => {
  const out = new Uint8ClampedArray(256 * 4);
  for (let a = 0; a < 256; a++) {
    const t = (a / 255) * (RAMP.length - 1);
    const i = Math.min(RAMP.length - 2, Math.floor(t));
    const f = t - i;
    for (let k = 0; k < 3; k++) out[a * 4 + k] = RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f;
    out[a * 4 + 3] = a ? Math.min(215, 70 + a * 0.9) : 0;
  }
  return out;
})();

type Point = { x: number; y: number; n: number };

export function HeatmapViewer({ pages, from, to }: { pages: { path: string; views: number }[]; from: string; to: string }) {
  const [path, setPath] = useState(pages[0]?.path ?? "/");
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<Mode>("clicks");
  const [data, setData] = useState<HeatmapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [boxWidth, setBoxWidth] = useState(900);

  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const points = useRef<Point[]>([]);
  const mouseY = useRef<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/heatmap?${new URLSearchParams({ path, device, from, to })}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`The heatmap couldn't be loaded (${r.status}).`);
        return (await r.json()) as HeatmapData;
      })
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "The heatmap couldn't be loaded."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, device, from, to]);

  /** Where each recorded click sits on the page as it is now. */
  const place = useCallback(() => {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    if (!doc || !win || !data) return;
    const found = new Map<string, Element | null>();
    const pageWidth = doc.documentElement.scrollWidth;
    points.current = data.spots.map((s) => {
      if (!found.has(s.s)) {
        let el: Element | null = null;
        try {
          el = doc.querySelector(s.s);
        } catch {}
        found.set(s.s, el);
      }
      const el = found.get(s.s);
      const r = el?.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        return { x: r.left + win.scrollX + (s.rx / 1000) * r.width, y: r.top + win.scrollY + (s.ry / 1000) * r.height, n: s.n };
      }
      return { x: (s.x / 1000) * pageWidth, y: s.y, n: s.n };
    });
  }, [data]);

  const draw = useCallback(() => {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    const c = canvas.current;
    if (!doc || !win || !c || !data) return;
    const w = win.innerWidth;
    const h = win.innerHeight;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const sx = win.scrollX;
    const sy = win.scrollY;
    // The page is shrunk to fit the admin; draw spots and labels at a size that reads well after shrinking.
    const k = 1 / Math.min(1, (frame.current?.getBoundingClientRect().width || w) / w);

    if (mode === "clicks") {
      if (!points.current.length) return;
      const R = Math.round((device === "mobile" ? 18 : 22) * k);
      const brush = document.createElement("canvas");
      brush.width = brush.height = R * 2;
      const b = brush.getContext("2d")!;
      const g = b.createRadialGradient(R, R, 0, R, R, R);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      b.fillStyle = g;
      b.fillRect(0, 0, R * 2, R * 2);
      const max = Math.max(...points.current.map((p) => p.n));
      for (const p of points.current) {
        const x = p.x - sx;
        const y = p.y - sy;
        if (x < -R || y < -R || x > w + R || y > h + R) continue;
        ctx.globalAlpha = Math.max(0.12, p.n / max);
        ctx.drawImage(brush, x - R, y - R);
      }
      ctx.globalAlpha = 1;
      const img = ctx.getImageData(0, 0, w, h);
      const px = img.data;
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];
        if (!a) continue;
        px[i] = PALETTE[a * 4];
        px[i + 1] = PALETTE[a * 4 + 1];
        px[i + 2] = PALETTE[a * 4 + 2];
        px[i + 3] = PALETTE[a * 4 + 3];
      }
      ctx.putImageData(img, 0, 0);
      return;
    }

    // Scroll map: the further down, the fewer visitors got there, the darker the page.
    if (!data.views) return;
    const pageHeight = Math.max(doc.documentElement.scrollHeight, 1);
    const reachAt = (docY: number) => {
      const pctDown = Math.min(100, (docY / pageHeight) * 100) / 5;
      const i = Math.floor(pctDown);
      const f = pctDown - i;
      const a = data.reach[i] ?? 0;
      const b2 = data.reach[Math.min(20, i + 1)] ?? 0;
      return a + (b2 - a) * f;
    };
    for (let y = 0; y < h; y += 4) {
      const share = reachAt(sy + y);
      ctx.fillStyle = `rgba(20,20,20,${(0.62 * (1 - share)).toFixed(3)})`;
      ctx.fillRect(0, y, w, 4);
    }
    ctx.font = `600 ${Math.round(13 * k)}px system-ui, sans-serif`;
    const marker = (docY: number, text: string, dashed: boolean) => {
      const y = docY - sy;
      if (y < 0 || y > h) return;
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.5 * k;
      ctx.setLineDash(dashed ? [6 * k, 4 * k] : []);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      const tw = ctx.measureText(text).width + 16 * k;
      ctx.fillStyle = "#111";
      ctx.fillRect(12 * k, y - 13 * k, tw, 26 * k);
      ctx.fillStyle = "#fff";
      ctx.fillText(text, 20 * k, y + 4.5 * k);
    };
    for (const level of [0.75, 0.5, 0.25]) {
      let d = 0;
      while (d < 100 && reachAt((d / 100) * pageHeight) >= level) d += 0.5;
      if (d < 100) marker((d / 100) * pageHeight, `${Math.round(level * 100)}% of visitors scrolled this far`, true);
    }
    if (mouseY.current !== null) {
      const docY = mouseY.current;
      marker(docY, `${Math.round(reachAt(docY) * 100)}% got this far`, false);
    }
  }, [data, mode, device]);

  // Set up the overlay inside the frame once the shop page has loaded.
  const onFrameLoad = () => {
    const doc = frame.current?.contentDocument;
    const win = frame.current?.contentWindow;
    if (!doc || !win) return;
    const c = doc.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh", zIndex: "2147483647", pointerEvents: "none" });
    doc.body.appendChild(c);
    canvas.current = c;
    // A preview: clicks inside it don't open links or submit anything.
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    doc.addEventListener("click", stop, true);
    doc.addEventListener("submit", stop, true);
    doc.addEventListener("mousemove", (e) => {
      mouseY.current = e.pageY;
      win.requestAnimationFrame(() => drawRef.current());
    });
    doc.addEventListener("mouseleave", () => {
      mouseY.current = null;
      win.requestAnimationFrame(() => drawRef.current());
    });
    win.addEventListener("scroll", () => win.requestAnimationFrame(() => drawRef.current()), { passive: true });
    let t: ReturnType<typeof setTimeout> | undefined;
    new (win as Window & typeof globalThis).ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        placeRef.current();
        drawRef.current();
      }, 200);
    }).observe(doc.body);
    setFrameReady(true);
  };

  const drawRef = useRef(draw);
  const placeRef = useRef(place);
  useEffect(() => {
    drawRef.current = draw;
    placeRef.current = place;
    if (frameReady) {
      place();
      draw();
    }
  }, [draw, place, frameReady]);

  // Pictures and lists fill in after the page loads; place the clicks again once they have.
  useEffect(() => {
    if (!frameReady) return;
    const timers = [800, 2500].map((ms) =>
      setTimeout(() => {
        placeRef.current();
        drawRef.current();
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [frameReady, data]);

  const showElement = (selector: string) => {
    const doc = frame.current?.contentDocument;
    let el: HTMLElement | null = null;
    try {
      el = doc?.querySelector<HTMLElement>(selector) ?? null;
    } catch {}
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const before = el.style.outline;
    el.style.outline = "3px solid #2a78d6";
    el.style.outlineOffset = "2px";
    setTimeout(() => {
      el!.style.outline = before;
    }, 2200);
  };

  const width = WIDTHS[device];
  const scale = Math.min(1, boxWidth / width);
  const total = data?.clicks ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm sm:max-w-md">
          <span className="mb-1 block text-xs text-ink-muted">Page</span>
          <select
            value={path}
            onChange={(e) => {
              setFrameReady(false);
              setPath(e.target.value);
            }}
            className="input w-full"
          >
            {!pages.some((p) => p.path === path) && <option value={path}>{path === "/" ? "Homepage" : path}</option>}
            {pages.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path === "/" ? "Homepage" : p.path} · {count.format(p.views)} {p.views === 1 ? "view" : "views"}
              </option>
            ))}
          </select>
        </label>
        <Toggle
          label="Device"
          value={device}
          onChange={(d) => {
            setFrameReady(false);
            setDevice(d);
          }}
          options={[
            ["desktop", "Desktop"],
            ["tablet", "Tablet"],
            ["mobile", "Phone"],
          ]}
        />
        <Toggle
          label="Show"
          value={mode}
          onChange={setMode}
          options={[
            ["clicks", "Click map"],
            ["scroll", "Scroll map"],
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div ref={box} className="min-w-0">
          <div
            className="relative mx-auto overflow-hidden rounded border border-line bg-white"
            style={{ width: width * scale, height: VIEW_HEIGHT }}
          >
            <iframe
              key={`${path}|${device}`}
              ref={frame}
              src={path}
              title={`Heatmap of ${path === "/" ? "the homepage" : path}`}
              onLoad={onFrameLoad}
              style={{ width, height: VIEW_HEIGHT / scale, transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }}
            />
            {(loading || !frameReady) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-ink-muted">Loading the page…</div>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-ink-muted">
            {mode === "clicks"
              ? "Darker red = more clicks. Scroll inside the page to see all of it."
              : "The darker the page, the fewer visitors scrolled that far. Point at the page to read the share."}
          </p>
        </div>

        <aside className="space-y-5 text-sm">
          {error && <p className="text-sale">{error}</p>}
          <dl className="grid grid-cols-3 gap-3 xl:grid-cols-1">
            <Fact label="Page views" value={data ? count.format(data.views) : "—"} />
            <Fact label="Clicks" value={data ? count.format(data.clicks) : "—"} />
            <Fact label="Average scroll depth" value={data?.averageDepth != null ? `${Math.round(data.averageDepth)}%` : "—"} />
          </dl>
          <div>
            <h3 className="mb-2 font-medium">Most clicked</h3>
            {data?.labels.length ? (
              <ol className="space-y-1.5">
                {data.labels.map((l) => (
                  <li key={l.label}>
                    <button
                      type="button"
                      onClick={() => showElement(l.s)}
                      className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-line-soft"
                      title="Show it on the page"
                    >
                      <span className="min-w-0 flex-1 truncate">{l.label}</span>
                      <span className="shrink-0 tabular-nums font-medium">{count.format(l.n)}</span>
                      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                        {total ? `${((l.n / total) * 100).toFixed(1)}%` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink-muted">{loading ? "Loading…" : "No clicks recorded on this page for this device and period yet."}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Toggle<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="text-sm">
      <span className="mb-1 block text-xs text-ink-muted">{label}</span>
      <div className="flex overflow-hidden rounded border border-line" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn("px-3 py-2 transition-colors", value === v ? "bg-ink text-white" : "bg-white hover:bg-line-soft")}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line p-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
