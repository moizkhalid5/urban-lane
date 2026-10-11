import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge middleware: protect /admin (ADMIN or STAFF) and /account (any user).
 * Authorization is also enforced server-side in each route/server-action; this
 * is the first gate so unauthorized users never reach protected pages.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Cookie name + salt depend on whether the session was issued over HTTPS, NOT NODE_ENV:
  // `next start` runs with NODE_ENV=production even on http://localhost. Behind a host's
  // HTTPS proxy (Hostinger) the app itself may see plain http, so trust the cookie that exists.
  const secureCookie =
    req.cookies.has("__Secure-authjs.session-token") ||
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";
  const cookieName = secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
    salt: cookieName,
  });

  if (pathname.startsWith("/admin")) {
    if (!token) {
      const url = new URL("/login", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
    if (token.role !== "ADMIN" && token.role !== "STAFF") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (pathname.startsWith("/account")) {
    if (!token) {
      const url = new URL("/login", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
