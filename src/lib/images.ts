/**
 * How sharp product photos are on the shop. Pages don't send the stored photo itself but a copy the size
 * of the screen (Next.js image optimiser, /_next/image), re-compressed at this quality as WebP
 * (next.config.mjs). The default, 75 (and AVIF), smudged fine detail such as prints and knits; at 90 they
 * look like the stored photo. Allowed values: images.qualities in next.config.mjs.
 */
export const PHOTO_QUALITY = 90;
