import type { MetadataRoute } from "next";

import { APP_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/api", "/checkout", "/cart", "/login", "/register", "/reset-password", "/verify-email"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
