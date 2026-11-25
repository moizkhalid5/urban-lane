/** The menu entry of the running sale (lib/sale.ts: 11.11, Black Friday), shown in red like Outlet. Safe to import in the browser. */
export const SALE_NAV_SLUG = "sale-event";

/** Menu entries shown in red. */
export const isRedNavItem = (slug: string) => slug === "outlet" || slug === SALE_NAV_SLUG;
