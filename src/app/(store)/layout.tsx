import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getNavTree } from "@/lib/queries/nav";
import { getCurrencies, getSiteSettings } from "@/lib/settings";
import { getActiveCurrency } from "@/lib/currency.server";
import { getCartCount } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth/guards";
import { getWishlistCount } from "@/lib/wishlist";
import { BottomNav } from "@/components/layout/BottomNav";
import { Analytics } from "@/components/analytics/Analytics";
import { getAnalyticsIds } from "@/lib/analytics/settings";

// The storefront renders per request (cart, currency cookie, session) and reads
// the database in this layout. Forcing dynamic rendering keeps the production
// BUILD free of any database access — the DB only needs to be reachable at
// runtime, not at build time (Hostinger does not expose env vars during build).
export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [nav, currencies, active, settings, user, cartCount, wishlistCount, analytics] = await Promise.all([
    getNavTree(),
    getCurrencies(),
    getActiveCurrency(),
    getSiteSettings(),
    getCurrentUser(),
    getCartCount(),
    getWishlistCount(),
    getAnalyticsIds(),
  ]);
  const isStaff = user?.role === "ADMIN" || user?.role === "STAFF";
  // Analytics leaves out the shop's own team, so their browsing doesn't count as shoppers'.
  const measure = !isStaff && !!(analytics.gaMeasurementId || analytics.clarityProjectId);

  return (
    <div className="flex min-h-screen flex-col">
      {measure && <Analytics {...analytics} />}
      <Header
        nav={nav}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol, flag: c.flag }))}
        activeCurrency={active.code}
        announcement={settings.announcementText}
        isAuthed={!!user}
        isStaff={isStaff}
        cartCount={cartCount}
      />
      <main className="flex-1">{children}</main>
      <Footer cookieSettings={measure} />
      {/* Room under the footer for the phone bottom bar */}
      <div aria-hidden className="h-24 md:hidden" />
      <BottomNav isAuthed={!!user} wishlistCount={wishlistCount} />
    </div>
  );
}
