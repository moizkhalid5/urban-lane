"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useColourSelection } from "./ColourSelection";

type Photo = { url: string; alt: string | null };

/**
 * `colourPhotos`: the photo of each colour (set in Admin → Products), so picking a colour shows its photo
 * and clicking a colour's photo picks that colour.
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

  const shown = images.filter((img) => !failed.has(img.url));
  if (shown.length === 0) {
    return <div className="aspect-[4/5] bg-line-soft" />;
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

  // Phones: main photo, then a thumbnail strip that scrolls sideways inside the page width.
  // Desktop: a 5rem thumbnail column beside the photo. The column adds no height to the row
  // (h-0) and fills the photo's height (min-h-full), scrolling when there are more thumbnails
  // than fit, so the photo always keeps its 4:5 shape. self-start stops the gallery stretching
  // to the height of the product details column.
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
                "relative aspect-[4/5] w-16 shrink-0 overflow-hidden border md:w-full",
                i === current ? "border-ink" : "border-line hover:border-ink-muted",
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? title}
                fill
                sizes="80px"
                className="object-cover"
                onError={() => markFailed(img.url)}
              />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-[4/5] min-w-0 flex-1 overflow-hidden bg-line-soft">
        <Image
          key={shown[current].url}
          src={shown[current].url}
          alt={shown[current].alt ?? title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="animate-fade-in object-cover"
          onError={() => markFailed(shown[current].url)}
        />
      </div>
    </div>
  );
}
