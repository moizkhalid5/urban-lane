"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-[4/5] bg-line-soft" />;
  }

  const hasThumbs = images.length > 1;

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
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                // md:w-full: fills the 5rem column, or the space beside its scrollbar when it scrolls.
                "relative aspect-[4/5] w-16 shrink-0 overflow-hidden border md:w-full",
                i === active ? "border-ink" : "border-line hover:border-ink-muted",
              )}
            >
              <Image src={img.url} alt={img.alt ?? title} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-[4/5] min-w-0 flex-1 overflow-hidden bg-line-soft">
        <Image
          key={active}
          src={images[active].url}
          alt={images[active].alt ?? title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="animate-fade-in object-cover"
        />
      </div>
    </div>
  );
}
