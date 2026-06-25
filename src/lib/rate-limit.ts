import "server-only";
import { headers } from "next/headers";

/**
 * Lightweight in-memory rate limiter (fixed window). Suitable for a single
 * instance; for multi-instance deployments, back this with Redis/Upstash and
 * keep the same `rateLimit()` signature so call sites don't change.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { ok: true, retryAfterMs: bucket.resetAt - now };
}

/** Best-effort client identifier from proxy headers (falls back to "local"). */
export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local";
  return `${scope}:${ip}`;
}

// Periodically prune expired buckets to bound memory.
const PRUNE_INTERVAL = 10 * 60 * 1000;
let lastPrune = Date.now();
export function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}
