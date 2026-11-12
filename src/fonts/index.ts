import localFont from "next/font/local";

/**
 * The shop's web fonts, stored in this folder (Latin, woff2) instead of fetched from Google Fonts during
 * the build: a build that can't reach Google, or gets an unexpected answer from it, used to fail
 * ("An error occurred in `next/font`" on Hostinger). Same fonts as before; all under the SIL Open Font
 * License (free to self-host). Downloaded from fonts.gstatic.com: Inter v20, Playfair Display v40, Anton v27.
 */

/** Body text everywhere (shop and admin): Inter, variable weight 100–900. */
export const inter = localFont({
  src: "./inter-latin-var.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});

/** Serif headings: Beauty pages (via --font-beauty-serif) and the 11.11 sale wording. Variable 400–900, upright and italic. */
export const playfair = localFont({
  src: [
    { path: "./playfair-display-latin-var.woff2", weight: "400 900", style: "normal" },
    { path: "./playfair-display-latin-italic-var.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-beauty-serif",
  display: "swap",
});

/** The homepage rail's tall display lettering. */
export const anton = localFont({
  src: "./anton-latin-400.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
});
