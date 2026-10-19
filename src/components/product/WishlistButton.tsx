"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWishlist } from "@/app/actions/account";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  initial,
  authed,
  variant = "button",
}: {
  productId: string;
  initial: boolean;
  authed: boolean;
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!authed) {
      router.push("/login?callbackUrl=/account/wishlist");
      return;
    }
    startTransition(async () => {
      const prev = wishlisted;
      setWishlisted(!prev); // optimistic
      const res = await toggleWishlist(productId);
      if (!res.ok) setWishlisted(prev);
      else setWishlisted(res.wishlisted);
    });
  }

  const heart = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        className={cn("text-ink transition-colors", wishlisted && "text-sale")}
      >
        {heart}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn("btn-ghost w-full", wishlisted && "border-ink")}
    >
      {heart}
      {wishlisted ? "Saved to wishlist" : "Add to wishlist"}
    </button>
  );
}
