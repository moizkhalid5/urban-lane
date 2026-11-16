import type { Metadata } from "next";
import { inter } from "@/fonts";
import "./globals.css";


import { APP_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Urban Lane: Original UK Brands Online in Pakistan",
    template: "%s | Urban Lane",
  },
  description:
    "Original UK high-street brands in Pakistan: clothing for women, men and kids, and original makeup. Cash on delivery, Easypaisa and JazzCash.",
  openGraph: {
    type: "website",
    siteName: "Urban Lane",
    locale: "en_PK",
    url: APP_URL,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
