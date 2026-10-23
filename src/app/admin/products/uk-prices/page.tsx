import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { UkPriceImport } from "@/components/admin/UkPriceImport";

export const dynamic = "force-dynamic";

export default async function ImportUkPricesPage() {
  await requireStaff();
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/products" className="text-sm text-ink-muted hover:text-ink">
        ← Products
      </Link>
      <h1 className="text-2xl font-medium">Import UK prices</h1>
      <p className="max-w-3xl text-sm text-ink-muted">
        Each product&apos;s real UK retail price. Where our price is lower, the shop shows &ldquo;UK price Rs X · Save
        Y%&rdquo; under it. Our prices don&apos;t change. One product&apos;s UK price can also be edited on its own page.
      </p>
      <UkPriceImport />
    </div>
  );
}
