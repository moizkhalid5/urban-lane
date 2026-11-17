/** Where a wholesale conversation stands (shared by server and browser code). */
export const STAGES = [
  { key: "NEW", label: "To contact", tone: "bg-[#eef2f7] text-[#2b3a55]" },
  { key: "CONTACTED", label: "Contacted", tone: "bg-[#e3eefb] text-[#1c5cab]" },
  { key: "REPLIED", label: "Replied", tone: "bg-[#fff4d6] text-[#7a5200]" },
  { key: "NEGOTIATING", label: "Negotiating", tone: "bg-[#ece9fb] text-[#4a3aa7]" },
  { key: "WON", label: "Won", tone: "bg-[#e3f6e3] text-[#006300]" },
  { key: "LOST", label: "Not now", tone: "bg-[#f1f0ec] text-[#5f5e5a]" },
] as const;
export type Stage = (typeof STAGES)[number]["key"];
export const stageOf = (key: string) => STAGES.find((s) => s.key === key) ?? STAGES[0];
