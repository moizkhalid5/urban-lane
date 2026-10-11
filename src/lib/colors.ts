/**
 * Colour names from the master sheet have no hex codes. Pick a swatch from the name
 * (a CSS colour or a gradient for patterns) so filters and product pages can show it.
 */
const SWATCHES: [RegExp, string][] = [
  [/multi|floral|print|check|stripe|spot|leopard|animal|tartan/, "conic-gradient(#e57373,#ffd54f,#81c784,#64b5f6,#ba68c8,#e57373)"],
  [/black|jet|obsidian/, "#111"],
  [/navy/, "#1f2a44"],
  [/charcoal|dark grey/, "#444"],
  [/grey|gray|silver|marl/, "#9e9e9e"],
  [/light blue|sky|turquoise|aqua/, "#9fc9e6"],
  [/teal/, "#1f8a8a"],
  [/blue|indigo|denim/, "#3b6fb6"],
  [/burgundy|plum|wine|berry/, "#6d1b3b"],
  [/red|cherry/, "#c62828"],
  [/pink|blush|rose/, "#f2a7c0"],
  [/coral|peach/, "#f4977a"],
  [/orange|rust/, "#ef7d32"],
  [/mustard|gold/, "#d4a52c"],
  [/yellow|lemon/, "#f2d14c"],
  [/khaki|olive/, "#7d7a4a"],
  [/green|mint|sage|jade/, "#4f8a55"],
  [/lilac|lavender|mauve/, "#b99ac7"],
  [/purple|violet/, "#7e57c2"],
  [/brown|tan|camel|tort|truffle/, "#8a5a36"],
  [/stone|beige|sand|natural|nude|ecru|cream|off white|ivory/, "#e3d6bf"],
  [/white/, "#fff"],
];
export const swatchFor = (name: string) => SWATCHES.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? null;
