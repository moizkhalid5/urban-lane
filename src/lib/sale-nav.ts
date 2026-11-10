/** The menu entry of the 11.11 sale (lib/sale.ts), shown in red like Outlet. Safe to import in the browser. */
export const SALE_NAV_SLUG = "sale-1111";

/** Menu entries shown in red. */
export const isRedNavItem = (slug: string) => slug === "outlet" || slug === SALE_NAV_SLUG;
