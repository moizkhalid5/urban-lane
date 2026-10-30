/**
 * "Buttons" that are painted into banner artwork (SHOP NOW, DISCOVER…), as a box in % of the image.
 * A real link is placed over each one so it behaves like a button. Banners not listed here keep the
 * whole banner as the link.
 *
 * Measured from the image pixels (button background, or text + underline for text-style buttons).
 * Banner images are shown at their own aspect ratio, so % positions line up at every screen size. The
 * full-screen phone banners are trimmed slightly to fit the screen, so their links are laid out on the whole
 * picture (.phone-cover in globals.css) and stay on the painted button.
 * If an artwork image is replaced, re-measure its entry (or remove it).
 *
 * tone: the button's colour, which decides the hover effect (darken light buttons, lighten dark ones).
 * rest: how it stands out from the picture before it's touched: "lift" a soft shadow under a solid button,
 * "outline" a thin border around painted text. Used on phones, where there's no hover to show it's a button.
 */
export type BannerButton = {
  left: number;
  top: number;
  width: number;
  height: number;
  shape: "pill" | "rect" | "text";
  tone: "light" | "dark";
  label: string;
  rest?: "lift" | "outline";
};

export const BANNER_BUTTONS: Record<string, BannerButton> = {
  // Homepage carousel
  "/images/banners/women-2x1.jpg": { left: 32.49, top: 69.35, width: 15.68, height: 7.34, shape: "pill", tone: "light", label: "Shop now" },
  "/images/banners/kids-2x1.jpg": { left: 70.87, top: 60.89, width: 11.12, height: 6.1, shape: "text", tone: "light", label: "Discover" },
  "/images/banners/sale-2x1.jpg": { left: 12.74, top: 84.93, width: 14.35, height: 8.01, shape: "text", tone: "dark", label: "Shop now" },
  // Homepage hero slider (positions printed by scripts/build_home_banners.py)
  "/images/banners/home/urban-lane-1916.webp": { left: 9.03, top: 68.09, width: 14.82, height: 8.77, shape: "pill", tone: "dark", label: "Shop now" },
  "/images/banners/home/men-winter-1897.webp": { left: 58.62, top: 66.42, width: 19.4, height: 9.72, shape: "rect", tone: "dark", label: "Shop now" },
  "/images/banners/home/women-1862.webp": { left: 35.93, top: 73.43, width: 14.23, height: 7.77, shape: "pill", tone: "light", label: "Shop now" },
  "/images/banners/home/kids-summer-2406.webp": { left: 64.5, top: 66.35, width: 7.73, height: 4.95, shape: "text", tone: "light", label: "Discover" },
  "/images/banners/home/sale-season-1960.webp": { left: 10.87, top: 89.29, width: 12.24, height: 7.97, shape: "text", tone: "dark", label: "Shop now" },
  // ...and their full-screen phone versions
  "/images/banners/home/urban-lane-phone-v1.webp": { left: 28.8, top: 85.6, width: 42.2, height: 5.8, shape: "pill", tone: "dark", label: "Shop now", rest: "lift" },
  "/images/banners/home/men-winter-phone-v1.webp": { left: 32.4, top: 38.8, width: 37.4, height: 4.3, shape: "rect", tone: "dark", label: "Shop now", rest: "lift" },
  "/images/banners/home/women-phone-v1.webp": { left: 34.3, top: 29.5, width: 31.5, height: 4.1, shape: "pill", tone: "light", label: "Shop now", rest: "lift" },
  "/images/banners/home/kids-summer-phone-v1.webp": { left: 35, top: 89.2, width: 30, height: 4.4, shape: "text", tone: "light", label: "Discover", rest: "outline" },
  "/images/banners/home/sale-season-phone-v1.webp": { left: 7, top: 75.4, width: 29.3, height: 4.8, shape: "text", tone: "dark", label: "Shop now", rest: "outline" },
  // Beauty page banner: computers and phones
  "/images/banners/beauty-desktop-v1.webp": { left: 6.7, top: 68.54, width: 18.72, height: 8.29, shape: "pill", tone: "dark", label: "Shop now", rest: "lift" },
  "/images/banners/beauty-phone-v1.webp": { left: 27.31, top: 85.41, width: 45.38, height: 6.4, shape: "pill", tone: "dark", label: "Shop now", rest: "lift" },
  // Homepage winter banner (new artwork, Banners/winter_new.png): wide cut and phone version
  "/images/banners/home/winter-wide-1916.webp": { left: 71.4, top: 73.21, width: 11.59, height: 7.74, shape: "rect", tone: "dark", label: "Discover now" },
  "/images/banners/home/winter-1916.webp": { left: 71.4, top: 53.47, width: 11.59, height: 4.75, shape: "rect", tone: "dark", label: "Discover now" },
  // Homepage winter banner (previous artwork, still referenced by the PROMO banner record)
  "/images/banners/winter.jpg": { left: 74.7, top: 48.88, width: 15.01, height: 4.68, shape: "rect", tone: "dark", label: "Discover now" },
};

export function bannerButtonFor(image?: string | null): BannerButton | undefined {
  return image ? BANNER_BUTTONS[image.split("?")[0]] : undefined;
}
