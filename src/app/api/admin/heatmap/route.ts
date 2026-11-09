import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { DEVICES, cleanPath, heatmapData, type Device } from "@/lib/analytics/heatmap";

/** Staff only: one page's click and scroll map for Admin → Analytics → Heatmaps. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "STAFF")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams;
  const path = cleanPath(q.get("path"));
  const device = q.get("device") as Device;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!path || !DEVICES.includes(device) || !DATE.test(from) || !DATE.test(to)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  return NextResponse.json(await heatmapData(path, device, from, to), { headers: { "Cache-Control": "no-store" } });
}
