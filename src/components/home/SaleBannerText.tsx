import { playfair as serif } from "@/fonts";
import { cn } from "@/lib/utils";


/** The burnt orange of the sale wording, picked to sit with the coat in the main banner. */
const RUST = "#a4532a";

/**
 * "11.11 SALE · UP TO N% OFF" laid over the homepage's main "Urban Lane" banner during the sale (lib/sale.ts),
 * in its empty space: under "LANE" on tablets and computers, on a cream card above the painted Shop Now on
 * phones. The card is placed by its bottom edge (4% of the picture above the button, which starts at 85.6%),
 * so however tall its text runs on a phone it grows upwards, never onto the button. Real text, not painted, so the artwork keeps its quality and the wording goes when the sale ends.
 * Placed inside the banner's picture-shaped box; it doesn't catch clicks (the banner link is under it).
 */
export function SaleBannerText({ maxPct, phone }: { maxPct: number; phone?: boolean }) {
  if (phone) {
    return (
      <div
        aria-hidden
        className={cn(
          serif.className,
          "pointer-events-none absolute bottom-[18.5%] left-[14%] right-[14%] flex flex-col items-center rounded-sm bg-[#faf7f2]/90 px-[4%] py-[2.2%] text-ink shadow-[0_6px_24px_rgba(0,0,0,0.12)] backdrop-blur-[2px]",
        )}
      >
        <div className="flex items-baseline gap-[0.35em] leading-none">
          <span className="text-[11vw] font-bold italic" style={{ color: RUST }}>
            11.11
          </span>
          <span className="border-b border-ink/70 pb-[0.1em] text-[5vw] uppercase italic tracking-[0.16em]">
            Sale
          </span>
        </div>
        <div className="mt-[0.4em] flex items-baseline gap-[0.3em] leading-none">
          <span className="text-[2.7vw] uppercase tracking-[0.2em]">Up to</span>
          <span className="text-[8.5vw] font-bold" style={{ color: RUST }}>
            {maxPct}%
          </span>
          <span className="text-[4.2vw] font-bold uppercase italic">Off</span>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        serif.className,
        "pointer-events-none absolute left-[68.5%] right-[2%] top-[56%] flex flex-col items-start text-ink",
      )}
    >
      <div className="flex items-baseline gap-[0.3em] leading-none">
        <span className="text-[6.4vw] font-bold italic" style={{ color: RUST }}>
          11.11
        </span>
        <span className="border-b-2 border-ink/80 pb-[0.12em] text-[2.6vw] uppercase italic tracking-[0.18em]">
          Sale
        </span>
      </div>
      <div className="mt-[0.5vw] flex items-baseline gap-[0.6vw] leading-none">
        <span className="text-[1.05vw] uppercase tracking-[0.22em]">Up to</span>
        <span className="text-[4.6vw] font-bold" style={{ color: RUST }}>
          {maxPct}%
        </span>
        <span className="text-[1.9vw] font-bold uppercase italic">Off</span>
      </div>
    </div>
  );
}
