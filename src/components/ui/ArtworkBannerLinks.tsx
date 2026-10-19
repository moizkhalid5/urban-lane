import Link from "next/link";
import { cn } from "@/lib/utils";
import { bannerButtonFor } from "@/lib/banner-buttons";

/**
 * Links for an artwork banner (text and button painted into the image). Place inside the banner's
 * `relative` box, after the image.
 *
 * - Banner with a painted button: a real link sits exactly over the button, with hover and focus
 *   states. On devices that can hover (mouse), only that button is clickable. On touch screens the
 *   whole banner stays tappable too, because the painted buttons are small targets on a phone.
 * - Banner without a painted button: the whole banner is the link, as before.
 */
export function ArtworkBannerLinks({ image, href, label }: { image?: string | null; href: string; label: string }) {
  const button = bannerButtonFor(image);

  if (!button) {
    return <Link href={href} aria-label={label} className="absolute inset-0" />;
  }

  return (
    <>
      {/* Touch screens only: tap anywhere on the banner. Mouse users get the button below. */}
      <Link
        href={href}
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 [@media(hover:hover)]:pointer-events-none"
      />
      <Link
        href={href}
        aria-label={`${button.label}: ${label}`}
        style={{ left: `${button.left}%`, top: `${button.top}%`, width: `${button.width}%`, height: `${button.height}%` }}
        className={cn(
          "absolute z-10 block transition-[background-color,box-shadow] duration-200 ease-out",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
          button.shape === "pill" ? "rounded-full" : button.shape === "rect" ? "rounded-[3px]" : "rounded-md",
          // Darken a light button, lighten a dark one; solid buttons also lift with a soft shadow.
          button.tone === "light" ? "hover:bg-black/[0.08]" : "hover:bg-white/[0.16]",
          button.shape !== "text" && "hover:shadow-[0_8px_22px_rgba(0,0,0,0.28)]",
        )}
      />
    </>
  );
}
