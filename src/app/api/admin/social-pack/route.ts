import { auth } from "@/auth";
import { buildPack, MAX_POSTS, type Order, type PerPost } from "@/lib/social/pack";

export const dynamic = "force-dynamic";

/** Admin → Marketing → Social pack: downloads the CSV for the scheduler (admins only). */
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return new Response("Admins only", { status: 403 });

  const f = await req.formData();
  const str = (k: string) => String(f.get(k) ?? "").trim();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(str("start")) ? str("start") : new Date(Date.now() + 5 * 3600_000 + 86400_000).toISOString().slice(0, 10);
  const times = str("times")
    .split(/[,\s]+/)
    .map((t) => t.match(/^(\d{1,2}):(\d{2})$/))
    .filter((m): m is RegExpMatchArray => !!m && +m[1] < 24 && +m[2] < 60)
    .map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
  const order = (["sale", "newest", "popular"] as Order[]).includes(str("order") as Order) ? (str("order") as Order) : "sale";

  const { csv, count, first } = await buildPack(
    {
      start,
      days: Math.min(Math.max(1, Number(str("days")) || 30), MAX_POSTS),
      times: times.length ? [...new Set(times)].sort() : ["13:00", "18:00", "21:00"],
      photos: Math.min(Math.max(1, Number(str("photos")) || 1), 10),
      perPost: (str("perPost") === "product" ? "product" : "collection") as PerPost,
      maxPosts: Math.min(Math.max(1, Number(str("maxPosts")) || MAX_POSTS), MAX_POSTS),
      continueAfterLast: f.get("continueAfterLast") === "on",
      order,
      mix: f.get("mix") === "on",
      hashtags: str("hashtags").slice(0, 400),
      includeScheduled: f.get("includeScheduled") === "on",
    },
    f.get("remember") === "on",
  );
  if (!count) return new Response("No products left to post. Tick “Include products already in a pack” to start again.", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="urbanlane-social-pack-${first ? first.label.slice(0, 10).replace(/\//g, "-") : start}-${count}-posts.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
