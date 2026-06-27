/**
 * Canonical site URL, normalized once for the whole app.
 *
 * Hostinger (and other hosts) often store the domain without a scheme, e.g.
 * `urbanlane.uk`. A bare host breaks `new URL(...)` (used by Next's
 * `metadataBase`) with `ERR_INVALID_URL`, which fails the build. This helper
 * guarantees an absolute `https://…` URL with no trailing slash, so every call
 * site (metadata, sitemap, robots, emails) gets a valid base.
 */
function normalizeAppUrl(raw: string | undefined): string {
  const value = (raw || "http://localhost:3000").trim();
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

export const APP_URL = normalizeAppUrl(process.env.APP_URL);
