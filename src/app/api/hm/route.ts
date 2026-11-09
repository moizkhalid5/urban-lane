import { NextResponse } from "next/server";
import { clientKey, maybePrune, rateLimit } from "@/lib/rate-limit";
import { recordHeatmap } from "@/lib/analytics/heatmap";

/**
 * Clicks and scroll depth from shop pages, for Admin → Analytics → Heatmaps (sent by
 * components/analytics/HeatmapRecorder.tsx with navigator.sendBeacon). Always answers 204: a shopper's page
 * never waits on, or learns anything from, this.
 */
const MAX_BYTES = 48_000;

export async function POST(req: Request) {
  maybePrune();
  const done = new NextResponse(null, { status: 204 });
  if (!rateLimit(await clientKey("heatmap"), 40, 60_000).ok) return done;
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BYTES) return done;
  try {
    await recordHeatmap(JSON.parse(text));
  } catch (err) {
    console.error("[heatmap] Couldn't save clicks.", err);
  }
  return done;
}
