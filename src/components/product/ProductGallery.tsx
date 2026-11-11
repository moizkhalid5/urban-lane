"use client";

import Image from "next/image";
import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { PHOTO_QUALITY } from "@/lib/images";
import { useColourSelection } from "./ColourSelection";
import { ProductZoom } from "./ProductZoom";

/** How much the photo is magnified under the mouse (computers). */
const HOVER_ZOOM = 2.2;

type Photo = { url: string; alt: string | null };

/**
 * `colourPhotos`: the photo of each colour (set in Admin → Products), so picking a colour shows its photo
 * and clicking a colour's photo picks that colour.
 *
 * Zoom: on computers the photo is magnified under the mouse (the stored photo at full size, so details stay
 * sharp); clicking it, tapping it on phones, or the magnifier button opens the full-screen viewer
 * (ProductZoom: pinch, double-tap, scroll wheel).
 */
export function ProductGallery({
  images: productImages,
  title,
  colourPhotos = [],
}: {
  images: Photo[];
  title: string;
  colourPhotos?: { colour: string; photo: Photo }[];
}) {
  // A colour photo that isn't among the product photos is added at the end, so it can still be shown.
  const extra = colourPhotos
    .map((c) => c.photo)
    .filter((p, i, all) => all.findIndex((x) => x.url === p.url) === i && !productImages.some((img) => img.url === p.url));
  const images = [...productImages, ...extra];
  const [active, setActive] = useState(0);
  const selection = useColourSelection();
  const [shownColour, setShownColour] = useState(selection?.colour ?? null);
  // Photos whose file is missing on the server are dropped, instead of showing a broken image.
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const markFailed = (url: string) => setFailed((prev) => new Set(prev).add(url));
  // the mouse's place over the photo, in % (computers only), and whether the full-screen viewer is open
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const [viewer, setViewer] = useState(false);

  const shown = images.filter((img) => !failed.has(img.url));
  if (shown.length === 0) {
    return <div className="aspect-square rounded-2xl bg-line-soft" />;
  }
  // A new colour picked: show its photo (state adjusted during render, as React recommends over an effect).
  const picked = selection?.colour ?? null;
  if (picked !== shownColour) {
    setShownColour(picked);
    const url = colourPhotos.find((c) => c.colour === picked)?.photo.url;
    const i = url ? shown.findIndex((img) => img.url === url) : -1;
    if (i >= 0) setActive(i);
  }
  function choose(i: number) {
    setActive(i);
    // The photo of exactly one colour picks that colour; a shared photo (all colours together) doesn't.
    const colours = colourPhotos.filter((c) => c.photo.url === shown[i].url);
    if (selection && colours.length === 1 && colours[0].colour !== selection.colour) {
      setShownColour(colours[0].colour);
      selection.setColour(colours[0].colour);
    }
  }
  const current = Math.min(active, shown.length - 1);
  const hasThumbs = shown.length > 1;

  function moveLens(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  // Phones: main photo, then a thumbnail strip that scrolls sideways inside the page width.
  // Desktop: a 5rem thumbnail column beside the photo. The column adds no height to the row
  // (h-0) and fills the photo's height (min-h-full), scrolling when there are more thumbnails
  // than fit, so the photo always keeps its square shape. self-start stops the gallery stretching
  // to the height of the product details column.
  // The frame is square and shows the whole photo (product photos are square), on white with rounded
  // corners; before, a 4:5 frame cut off the photo's sides and zoomed in.
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col-reverse gap-4 md:self-start",
        hasThumbs && "md:grid md:grid-cols-[5rem_minmax(0,1fr)]",
      )}
    >
      {hasThumbs && (
        <div className="flex min-w-0 gap-3 overflow-x-auto md:h-0 md:min-h-full md:flex-col md:overflow-y-auto md:overflow-x-hidden">
          {shown.map((img, i) => (
            <button
              key={img.url}
              onClick={() => choose(i)}
              aria-label={`Photo ${i + 1}${colourPhotos.some((c) => c.photo.url === img.url) ? `: ${colourPhotos.filter((c) => c.photo.url === img.url).map((c) => c.colour).join(", ")}` : ""}`}
              className={cn(
                // md:w-full: fills the 5rem column, or the space beside its scrollbar when it scrolls.
                "relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border bg-white md:w-full",
                i === current ? "border-ink" : "border-line hover:border-ink-muted",
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? title}
                fill
                sizes="80px"
                quality={PHOTO_QUALITY}
                className="object-contain"
                onError={() => markFailed(img.url)}
              />
            </button>
          ))}
        </div>
      )}
      <div
        className="relative aspect-square min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-2xl border border-line-soft bg-white"
        onPointerMove={moveLens}
        onPointerLeave={() => setLens(null)}
        onClick={() => {
          setLens(null);
          setViewer(true);
        }}
      >
        <Image
          key={shown[current].url}
          src={shown[current].url}
          alt={shown[current].alt ?? title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          quality={PHOTO_QUALITY}
          className="animate-fade-in object-contain"
          onError={() => markFailed(shown[current].url)}
        />
        {/* Computers: the stored photo at full size, magnified around the mouse */}
        {lens && (
          // eslint-disable-next-line @next/next/no-img-element -- the stored photo itself, for zooming
          <img
            src={shown[current].url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full bg-white object-contain"
            style={{ transform: `scale(${HOVER_ZOOM})`, transformOrigin: `${lens.x}% ${lens.y}%` }}
          />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLens(null);
            setViewer(true);
          }}
          aria-label="Zoom in on this photo"
          title="Zoom"
          className={cn(
            "absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_2px_10px_rgba(0,0,0,0.15)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink",
            lens && "opacity-0",
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4M11 8v6M8 11h6" />
          </svg>
        </button>
      </div>
      {viewer && (
        <ProductZoom
          photos={shown}
          start={current}
          title={title}
          onClose={(i) => {
            setViewer(false);
            setActive(i);
          }}
        />
      )}
    </div>
  );
}
