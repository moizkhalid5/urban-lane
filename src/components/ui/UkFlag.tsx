import { cn } from "@/lib/utils";

/**
 * Small Union Jack, marking a price as the item's UK retail price (components/ui/Price). Drawn inline
 * because flag emoji show as "GB" letters on Windows. No ids, so it's safe to repeat on every card.
 */
export function UkFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" aria-hidden className={cn("inline-block h-[9px] w-[18px] shrink-0 rounded-[1px]", className)}>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
