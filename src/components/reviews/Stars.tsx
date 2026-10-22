import { cn } from "@/lib/utils";

const STAR = "M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.53L12 17.5l-5.87 3.07 1.12-6.53L2.5 9.41l6.56-.95L12 2.5z";

/** One star, filled or empty (e.g. the rating picker). */
export function Star({ filled, size = 14 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path d={STAR} fill={filled ? "#e8a93a" : "#e5e5e5"} />
    </svg>
  );
}

/** Five stars filled to `value` (0-5, fractions allowed, e.g. 4.3). */
export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (fill: string) => (
    <span className="flex gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
          <path d={STAR} fill={fill} />
        </svg>
      ))}
    </span>
  );
  return (
    <span className={cn("relative inline-flex", className)} role="img" aria-label={`${value} out of 5 stars`}>
      {row("#e5e5e5")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("#e8a93a")}
      </span>
    </span>
  );
}
