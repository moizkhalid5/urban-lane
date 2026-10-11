/**
 * Canonical site URL, normalised once for the whole app.
 *
 * Hosts often store the domain without a scheme (Hostinger: "urbanlane.uk"). A bare host
 * breaks `new URL(...)` (Next's metadataBase, sitemap, emails), so this always returns an
 * absolute URL with no trailing slash. Localhost keeps http; anything else gets https.
 */
function normalize(raw: string | undefined, fallback: string): string {
  const value = (raw || fallback).trim();
  const withScheme = /^https?:\/\//i.test(value)
    ? value
    : `${/^(localhost|127\.0\.0\.1)(:|$)/.test(value) ? "http" : "https"}://${value}`;
  return withScheme.replace(/\/+$/, "");
}

export const APP_URL = normalize(process.env.APP_URL, "http://localhost:3000");

// Auth.js reads AUTH_URL / NEXTAUTH_URL itself and also chokes on a bare host — fix them in place.
for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
  if (process.env[key]) process.env[key] = normalize(process.env[key], APP_URL);
}
