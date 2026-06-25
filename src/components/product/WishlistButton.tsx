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
    <svg width="18" height="18" viewBox="0 0 24 24" fill={wishlisted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z" />
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
