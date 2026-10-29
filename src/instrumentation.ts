/** Runs once when the server starts (Next.js instrumentation hook). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // One-time catalogue updates that Hostinger can't run as a separate step after a deploy
  const { applyVariantSkusOnce } = await import("@/lib/catalog/variant-skus");
  await applyVariantSkusOnce();
  // Easypaisa / JazzCash and the one-time payment settings fix (lib/payments/settings.ts)
  const { ensurePaymentTables } = await import("@/lib/payments/settings");
  await ensurePaymentTables().catch((err) => console.error("[payments] Couldn't set up the payment settings.", err));
}
