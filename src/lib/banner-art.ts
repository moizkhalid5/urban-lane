import placeholders from "./banner-placeholders.json";
import type { HomeSlide } from "./collection-heroes";

/**
 * A tiny blurred preview of a banner (made with its web copies by scripts/encode-banners.cjs), shown in the
 * banner's place while the picture itself downloads, so a slow connection sees the banner's colours at once
 * instead of a blank screen. About 300 bytes, inside the page.
 */
export function placeholderOf(src: string): string | undefined {
  return (placeholders as Record<string, string>)[src];
}

/** The homepage slides with the first one's previews filled in (the others load later anyway). */
export function withPlaceholders(slides: HomeSlide[]): HomeSlide[] {
  return slides.map((s, i) =>
    i === 0 ? { ...s, phonePlaceholder: placeholderOf(s.phone), desktopPlaceholder: placeholderOf(s.desktop) } : s,
  );
}
