import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getNavTree } from "@/lib/queries/nav";
import { getCurrencies, getSiteSettings } from "@/lib/settings";
import { getActiveCurrency } from "@/lib/currency.server";
import { getCartCount } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth/guards";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [nav, currencies, active, settings, user, cartCount] = await Promise.all([
    getNavTree(),
    getCurrencies(),
    getActiveCurrency(),
    getSiteSettings(),
    getCurrentUser(),
    getCartCount(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        nav={nav}
        currencies={currencies.map((c) => ({ code: c.code, symbol: c.symbol, flag: c.flag }))}
        activeCurrency={active.code}
        announcement={settings.announcementText}
        isAuthed={!!user}
        isStaff={user?.role === "ADMIN" || user?.role === "STAFF"}
        cartCount={cartCount}
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
