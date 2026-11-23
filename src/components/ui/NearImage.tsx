"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * true once `ref`'s element comes within `margin` of the screen (and from then on).
 *
 * For pictures further down a page: on a slow connection browsers start "lazy" pictures up to 2,500px
 * ahead of the screen, so a homepage's category and brand pictures downloaded alongside the banner at the
 * top and slowed it down. Waiting until they are actually close leaves the connection to the banner.
 */
export function useNear(ref: RefObject<Element | null>, margin = "300px") {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setNear(true);
      },
      { rootMargin: `${margin} 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return near;
}

/**
 * A `fill` next/image (its parent must be positioned) that is added only once its place is near the screen
 * (useNear). The link and words around it are in the page from the start, as before.
 */
export function NearImage(props: ImageProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const near = useNear(ref);
  return (
    <span ref={ref} className="absolute inset-0">
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through in props */}
      {near && <Image {...props} />}
    </span>
  );
}
