"use client";

import Image from "next/image";
import { useState } from "react";

const SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";

/**
 * A product card's photos: the main photo, and the second photo fading in over it on hover.
 * If a photo's file is missing on the server, the card falls back to the other photo, or to the
 * plain grey frame, instead of showing a broken image.
 */
export function ProductCardImages({ image, secondImage, alt }: { image: string; secondImage?: string | null; alt: string }) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const markFailed = (src: string) => setFailed((prev) => new Set(prev).add(src));
  const [primary, hover] = [image, secondImage].filter((s): s is string => !!s && !failed.has(s));

  if (!primary) return null;
  return (
    <>
      <Image key={primary} src={primary} alt={alt} fill sizes={SIZES} className="object-cover" onError={() => markFailed(primary)} />
      {/* Fades in over the first image, so a slow second image never leaves the card blank. */}
      {hover && (
        <Image
          src={hover}
          alt={alt}
          fill
          sizes={SIZES}
          className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          onError={() => markFailed(hover)}
        />
      )}
    </>
  );
}
