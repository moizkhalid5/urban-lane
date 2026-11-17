import { cn } from "@/lib/utils";
import { stageOf } from "@/lib/wholesale/stages";

/** Badges for Admin → Wholesale: a prospect's priority and stage. */
export function PriorityChip({ priority }: { priority: string }) {
  const tone =
    priority === "High"
      ? "bg-[#e3f6e3] text-[#006300]"
      : priority === "Medium"
        ? "bg-[#e3eefb] text-[#1c5cab]"
        : priority === "Check first"
          ? "bg-[#fbe6e6] text-[#a12a2a]"
          : "bg-[#f1f0ec] text-[#5f5e5a]";
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tone)}>{priority}</span>;
}

export function StageChip({ stage }: { stage: string }) {
  const s = stageOf(stage);
  return <span className={cn("whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", s.tone)}>{s.label}</span>;
}
