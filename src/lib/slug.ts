/** URL-safe slug from arbitrary text. Shared by app + seed (keep dependency-free). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Path-prefixed slug, e.g. childSlug("women", "Trousers") => "women-trousers". */
export function childSlug(parentSlug: string | null, name: string): string {
  const self = slugify(name);
  return parentSlug ? `${parentSlug}-${self}` : self;
}
