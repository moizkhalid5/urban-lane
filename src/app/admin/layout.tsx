import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { requireStaff } from "@/lib/auth/guards";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/account/LogoutButton";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = { title: "Admin — Urban Lane", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className={`${inter.variable} min-h-screen bg-line-soft`}>
      <div className="flex min-h-screen">
        {/* sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white lg:flex print:!hidden">
          <div className="border-b border-line p-5">
            <Link href="/admin" className="text-lg font-semibold uppercase tracking-[0.15em]">
              Urban Lane
            </Link>
            <p className="mt-0.5 text-xs text-ink-muted">Admin</p>
          </div>
          <div className="flex-1 p-3">
            <AdminNav />
          </div>
          <div className="border-t border-line p-4 text-sm">
            <p className="truncate text-ink-muted">{user.email}</p>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">{user.role}</p>
            <div className="flex items-center justify-between">
              <Link href="/" className="text-ink-muted hover:text-ink">View store</Link>
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile top bar */}
          <header className="flex items-center justify-between border-b border-line bg-white p-4 lg:hidden print:!hidden">
            <Link href="/admin" className="font-semibold uppercase tracking-wide">Admin</Link>
            <LogoutButton />
          </header>
          <main className="flex-1 p-5 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
