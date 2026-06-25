import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Urbane Lane — Premium Fashion & Lifestyle",
    template: "%s | Urbane Lane",
  },
  description:
    "Urbane Lane — premium fashion, beauty and lifestyle. Women, men, kids, beauty and jewellery with fast delivery.",
  openGraph: {
    type: "website",
    siteName: "Urbane Lane",
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
