import { NextResponse, type NextRequest } from "next/server";
import { ensureMailTables } from "@/lib/mail/db";
import { unsubscribe, validUnsubscribe } from "@/lib/mail/marketing";
import { APP_URL } from "@/lib/site";

/**
 * One-click unsubscribe from marketing emails (RFC 8058): mail apps POST here from the List-Unsubscribe
 * header. Opening the link in a browser goes to the unsubscribe page, which asks before doing it.
 */
export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("e") ?? "";
  const token = req.nextUrl.searchParams.get("t") ?? "";
  if (!email || !token || !validUnsubscribe(email, token)) return new NextResponse("Invalid link", { status: 400 });
  await ensureMailTables();
  await unsubscribe(email);
  return new NextResponse("Unsubscribed", { status: 200 });
}

export function GET(req: NextRequest) {
  return NextResponse.redirect(`${APP_URL}/unsubscribe${req.nextUrl.search}`, 303);
}
