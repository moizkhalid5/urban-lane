"use client";

import { useEffect } from "react";

const COOKIE = "ul_recent";
const MAX = 8;

/** Records the current product id in a cookie so the server can render "recently viewed". */
export function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    const existing =
      document.cookie
        .split("; ")
        .find((c) => c.startsWith(`${COOKIE}=`))
        ?.split("=")[1] ?? "";
    const ids = existing ? decodeURIComponent(existing).split(",").filter(Boolean) : [];
    const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX);
    document.cookie = `${COOKIE}=${encodeURIComponent(next.join(","))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }, [productId]);

  return null;
}
