import { randomInt } from "crypto";

/** Human-friendly, reasonably-unique order number, e.g. "UL-7F3K9Q". */
export function generateOrderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[randomInt(0, alphabet.length)];
  return `UL-${s}`;
}
