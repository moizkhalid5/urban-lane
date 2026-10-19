/**
 * "Buttons" that are painted into banner artwork (SHOP NOW, DISCOVER…), as a box in % of the image.
 * A real link is placed over each one so it behaves like a button. Banners not listed here keep the
 * whole banner as the link.
 *
 * Measured from the image pixels (button background, or text + underline for text-style buttons).
 * Banner images are shown at their own aspect ratio, so % positions line up at every screen size.
 * If an artwork image is replaced, re-measure its entry (or remove it).
 *
 * tone: the button's colour, which decides the hover effect (darken light buttons, lighten dark ones).
 */
export type BannerButton = {
  left: number;
  top: number;
  width: number;
  height: number;
  shape: "pill" | "rect" | "text";
  tone: "light" | "dark";
  label: string;
};

export const BANNER_BUTTONS: Record<string, BannerButton> = {
  // Homepage carousel
  "/images/banners/women-2x1.jpg": { left: 32.49, top: 69.35, width: 15.68, height: 7.34, shape: "pill", tone: "light", label: "Shop now" },
  "/images/banners/kids-2x1.jpg": { left: 70.87, top: 60.89, width: 11.12, height: 6.1, shape: "text", tone: "light", label: "Discover" },
  "/images/banners/sale-2x1.jpg": { left: 12.74, top: 84.93, width: 14.35, height: 8.01, shape: "text", tone: "dark", label: "Shop now" },
  // Homepage winter banner
  "/images/banners/winter.jpg": { left: 74.7, top: 48.88, width: 15.01, height: 4.68, shape: "rect", tone: "dark", label: "Discover now" },
  // Women / Men collection landing banners
  "/images/women/banner-autumn.jpg": { left: 21.82, top: 59.63, width: 12.76, height: 8.44, shape: "pill", tone: "dark", label: "Shop now" },
  "/images/men/banner-sale.jpg": { left: 26.46, top: 82.0, width: 15.05, height: 9.85, shape: "rect", tone: "dark", label: "Shop now" },
};

export function bannerButtonFor(image?: string | null): BannerButton | undefined {
  return image ? BANNER_BUTTONS[image.split("?")[0]] : undefined;
}
