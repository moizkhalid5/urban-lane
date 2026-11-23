import { getWholesaleStock } from "@/lib/wholesale/stock";
import { WHOLESALE_OFFER, wholesaleMinor } from "@/lib/wholesale/offer";
import { APP_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rupees = (minor: number) => Math.round(minor / 100);

/**
 * The wholesale stock list as a spreadsheet (CSV, opens in Excel), for business owners who'd rather work
 * from a file: every product in stock with its sizes, pieces and prices. Linked from /wholesale.
 */
export async function GET() {
  const { items } = await getWholesaleStock();
  const o = WHOLESALE_OFFER;
  const head = [
    "Brand",
    "Product",
    "Department",
    "Category",
    "Sizes in stock",
    "Pieces",
    "Shop price (Rs)",
    `Wholesale, under ${o.bulkMinPieces} pieces: ${o.basePct}% off (Rs)`,
    `Wholesale, ${o.bulkMinPieces}+ pieces: ${o.bulkPct}% off (Rs)`,
    "Link",
  ];
  const rows = items.map((i) => [
    i.brand,
    i.title,
    i.department,
    i.category,
    i.sizes.map((s) => `${s.label} x${s.stock}`).join(", "),
    i.pieces,
    rupees(i.priceMinor),
    rupees(wholesaleMinor(i.priceMinor, o.basePct)),
    rupees(wholesaleMinor(i.priceMinor, o.bulkPct)),
    `${APP_URL}/products/${i.slug}`,
  ]);
  // BOM so Excel reads the text as UTF-8 (£, é, ×…)
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="urban-lane-wholesale-stock-${day}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
