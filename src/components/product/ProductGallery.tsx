"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [active, setActive] = useState(0);
  if (images.length === 0) {
    return <div className="aspect-[4/5] bg-line-soft" />;
  }

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto md:flex-col md:overflow-visible">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                "relative aspect-[4/5] w-16 shrink-0 overflow-hidden border md:w-20",
                i === active ? "border-ink" : "border-line hover:border-ink-muted",
              )}
            >
              <Image src={img.url} alt={img.alt ?? title} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="relative aspect-[4/5] flex-1 overflow-hidden bg-line-soft">
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
