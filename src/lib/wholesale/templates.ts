import type { WholesaleProspect } from "@prisma/client";
import { defaultPitch, personalise, type WholesaleSettings } from "@/lib/wholesale/prospects";

/**
 * Ready-made messages for each step of the Pitch Guide ("send the pitch; call after 2 days; send photos of
 * their best-matching brand after 7 days"), filled in for the prospect: their name, the brands they
 * already sell, and your name, number, list link and discount tiers from the settings.
 */
export type Template = { key: string; label: string; subject: string; body: string };

/** Lines of "Our stock to offer them": "•" = brands they already sell, "+" = other lines that suit them. */
export function offerLines(stockToOffer: string | null) {
  const lines = (stockToOffer ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return {
    theySell: lines.filter((l) => !l.startsWith("+")).map((l) => l.replace(/^[•✓✔*\-–\s]+/, "")),
    alsoSuits: lines.filter((l) => l.startsWith("+")).map((l) => l.replace(/^\+\s*/, "")),
  };
}

export function tiersText(s: WholesaleSettings) {
  const set = s.tiers.filter((t) => t.minPieces && t.discount);
  if (!set.length) return null;
  return set.map((t) => `${t.minPieces}+ pieces: ${/%$/.test(t.discount) ? t.discount : `${t.discount}%`} off our retail price${t.notes ? ` (${t.notes})` : ""}`).join("\n");
}

export function templatesFor(p: WholesaleProspect, s: WholesaleSettings): Template[] {
  const { theySell } = offerLines(p.stockToOffer);
  const brandNames = (p.ourBrands ?? "").split(",").map((b) => b.trim()).filter(Boolean);
  const top = brandNames.slice(0, 3).join(", ") || "UK high-street brands";
  const best = theySell[0]?.replace(/\s*\(.*$/, "") ?? brandNames[0] ?? "our best-selling brand";
  const tiers = tiersText(s);
  const sign = "[Your name] | Urban Lane | [Your WhatsApp number]";
  const list = s.listUrl ? `Here's our wholesale list with photos and prices: ${s.listUrl}` : "I'll share our wholesale list with photos and prices.";

  const raw: Template[] = [
    { key: "pitch", label: "First pitch", subject: "Wholesale: original UK brands for " + p.name, body: p.pitch?.trim() || defaultPitch(p) },
    {
      key: "followup",
      label: "Follow-up (after 2 days)",
      subject: "Following up: UK brands wholesale",
      body: `Assalam-o-Alaikum ${p.name} team,

Just following up on my message about Urban Lane's wholesale stock: original, brand-new ${top}, already here in Pakistan, so no import, customs or waiting.

Would you like our wholesale list with photos and prices? Happy to make up a mixed lot for your range.

${sign}`,
    },
    {
      key: "photos",
      label: "Photos of their best brand (after 7 days)",
      subject: `${best}: photos from our wholesale stock`,
      body: `Assalam-o-Alaikum ${p.name} team,

Sharing a few photos of our ${best} stock, which you already sell: labels, care tags and packaging included, so you can see it's original and new.

If you'd like to try it first, we can send a small sample pack. Bigger orders get a bigger discount.

${sign}`,
    },
    {
      key: "list",
      label: "Send the wholesale list and tiers",
      subject: "Urban Lane wholesale list and bulk prices",
      body: `Assalam-o-Alaikum ${p.name} team,

${list}
${tiers ? `\nBulk discounts:\n${tiers}\n` : ""}
You choose the brands, sizes and departments, so you don't get stuck with one line. Delivery anywhere in Pakistan. For a first order we ask for advance bank transfer; repeat buyers keep their tier.

${sign}`,
    },
    {
      key: "sample",
      label: "Offer a sample pack",
      subject: "A sample pack of UK brands for " + p.name,
      body: `Assalam-o-Alaikum ${p.name} team,

To make it easy to decide, we can send a small sample pack from ${best} and the other brands you sell, so you can check the quality and labels yourself before ordering in bulk.

Shall I put one together for you?

${sign}`,
    },
  ];
  return raw.map((t) => ({ ...t, body: personalise(t.body, s) }));
}
