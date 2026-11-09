import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { syncAll, unreadCount } from "@/lib/mail/inbox";

export const dynamic = "force-dynamic";

/**
 * Admin menu → Inbox badge: checks the mailboxes for new mail (at most once a minute each, waiting no
 * more than 8 seconds) and returns how many emails are unread. Admins only.
 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ unread: 0 }, { status: 403 });
  await Promise.race([syncAll(60_000).catch(() => 0), new Promise((r) => setTimeout(r, 8000))]);
  return NextResponse.json({ unread: await unreadCount() }, { headers: { "Cache-Control": "no-store" } });
}
