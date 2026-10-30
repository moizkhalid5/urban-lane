"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { bannerButtonFor, type BannerButton } from "@/lib/banner-buttons";

/** How long a tap's pressed look stays on after the finger lifts, so even a quick tap shows it. */
const PRESS_MS = 180;

/**
 * Links for an artwork banner (text and button painted into the image). Place inside the banner's
 * `relative` box, after the image. That box must be the picture's own shape, so the button's % position
 * lines up (on phones: .phone-cover in globals.css).
 *
 * - Banner with a painted button: a real link sits exactly over the button, with hover, focus and press
 *   states. On devices that can hover (mouse), only that button is clickable. On touch screens the
 *   whole banner stays tappable too, because that's what shoppers expect of a banner.
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
      <PaintedButton button={button} href={href} label={label} />
    </>
  );
}

function PaintedButton({ button, href, label }: { button: BannerButton; href: string; label: string }) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const press = () => {
    clearTimeout(timer.current);
    setPressed(true);
  };
  const release = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPressed(false), PRESS_MS);
  };

  return (
    <Link
      href={href}
      aria-label={`${button.label}: ${label}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      // A tiny tap on phones that support it (Android; iPhones ignore it).
      onClick={() => navigator.vibrate?.(12)}
      style={{ left: `${button.left}%`, top: `${button.top}%`, width: `${button.width}%`, height: `${button.height}%` }}
      className={cn(
        "absolute z-10 block touch-manipulation select-none transition-[background-color,box-shadow,transform] duration-150 ease-out [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        button.shape === "pill" ? "rounded-full" : button.shape === "rect" ? "rounded-[3px]" : "rounded-md",
        // Darken a light button, lighten a dark one; solid buttons also lift with a soft shadow.
        button.tone === "light" ? "hover:bg-black/[0.08]" : "hover:bg-white/[0.16]",
        button.shape !== "text" && "hover:shadow-[0_8px_22px_rgba(0,0,0,0.28)]",
        // At rest it stands out from the picture...
        button.rest === "lift" && "shadow-[0_6px_16px_rgba(0,0,0,0.38)]",
        button.rest === "outline" && "ring-1 ring-inset",
        button.rest === "outline" && (button.tone === "light" ? "ring-ink/50" : "ring-white/80"),
        // ...and under a finger it sinks in.
        pressed && "scale-95 !shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]",
        pressed && (button.tone === "light" ? "bg-black/[0.14]" : "bg-white/[0.28]"),
      )}
    />
  );
}
