/**
 * Admin → Analytics colours. Categorical hues carry identity (a department, a payment method, a device) and
 * stay with that thing everywhere; the four used together were checked for colour-blind separation as a full
 * set (blue, orange, aqua, berry). Sequential = one hue, light → dark. Status colours only mean status, and
 * always come with a written label.
 */
export const PALETTE = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  berry: "#a8327f",
  violet: "#6250d6",
  red: "#e34948",
  ink: "#2b2f3a",
  axis: "#c3c2b7",
  grid: "#e1e0d9",
  empty: "#f1f0ec",
  other: "#8a8984",
} as const;

/** Departments: the same colour in every chart. */
export const DEPARTMENT_COLORS = [
  { name: "Women", color: PALETTE.berry },
  { name: "Men", color: PALETTE.blue },
  { name: "Kids", color: PALETTE.aqua },
  { name: "Beauty", color: PALETTE.orange },
];

/** Payment methods: the same colour wherever they appear. */
export const PAYMENT_COLORS: Record<string, string> = {
  COD: PALETTE.blue,
  EASYPAISA: PALETTE.aqua,
  JAZZCASH: PALETTE.orange,
  BANK_TRANSFER: PALETTE.berry,
};

/** Devices / visitor types, in GA's own names (lower case). */
export const DEVICE_COLORS: Record<string, string> = {
  mobile: PALETTE.blue,
  desktop: PALETTE.orange,
  tablet: PALETTE.aqua,
};
export const VISITOR_COLORS: Record<string, string> = {
  new: PALETTE.blue,
  returning: PALETTE.orange,
};

/** Magnitude (heatmap): blue, light → dark. */
export const SEQUENTIAL = [
  "#b7d3f6",
  "#86b6ef",
  "#5598e7",
  "#2a78d6",
  "#1c5cab",
  "#104281",
];
/** Ordered steps (funnel): blue, no lighter than step 250 so the lightest still stands off white. */
export const FUNNEL_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];

/** Order status pills: text label + tinted fill (status colours for good / bad states). */
export const STATUS_STYLE: Record<
  string,
  { label: string; bg: string; fg: string; dot: string }
> = {
  UNFULFILLED: { label: "Unfulfilled", bg: "#fff4d6", fg: "#7a5200", dot: "#fab219" },
  PROCESSING: { label: "Processing", bg: "#e3eefb", fg: "#1c5cab", dot: PALETTE.blue },
  SHIPPED: { label: "Shipped", bg: "#ece9fb", fg: "#4a3aa7", dot: PALETTE.violet },
  DELIVERED: { label: "Delivered", bg: "#e3f6e3", fg: "#006300", dot: "#0ca30c" },
  CANCELLED: { label: "Cancelled", bg: "#fbe6e6", fg: "#a12a2a", dot: "#d03b3b" },
  RETURNED: { label: "Returned", bg: "#fdeee6", fg: "#9a4317", dot: "#ec835a" },
};

/** Headline cards: a gradient each, dark end under the text (white text ≥ 5:1 there). */
export const GRADIENTS = {
  sales: ["#be2f6a", "#e0679a"],
  orders: ["#5b3cc4", "#8b6cf0"],
  aov: ["#1f5fb8", "#4f97ee"],
  sessions: ["#b8460f", "#ec7a2c"],
  conversion: ["#0b7a6e", "#1fb39a"],
  returning: ["#2e3a59", "#5d6f99"],
} as const;

/** Label colour on a fill: white when it reads at 4.5:1 or better, otherwise near-black. */
export function textOn(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (l + 0.05) >= 4.5 ? "#ffffff" : "#111111";
}
