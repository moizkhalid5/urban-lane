/** Runs once when the server starts (Next.js instrumentation hook). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // One-time catalogue updates that Hostinger can't run as a separate step after a deploy
  const { applyVariantSkusOnce } = await import("@/lib/catalog/variant-skus");
  await applyVariantSkusOnce();
}
