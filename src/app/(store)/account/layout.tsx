import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/account/LogoutButton";

const links = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/wishlist", label: "Wishlist" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");

  return (
    <div className="container-site py-10">
      <h1 className="text-3xl font-medium">My Account</h1>
      <p className="mt-1 text-sm text-ink-muted">{user.email}</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside>
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="whitespace-nowrap border-b border-line py-2 text-sm text-ink-soft hover:text-ink lg:border-b-0"
              >
                {l.label}
              </Link>
            ))}
            <div className="py-2">
              <LogoutButton />
            </div>
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
