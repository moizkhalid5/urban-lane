import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { CustomerForm } from "@/components/admin/orders/CustomerForm";

export const dynamic = "force-dynamic";

/** Admin → Customers → Add customer. */
export default async function NewCustomerPage() {
  await requireStaff();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/customers" className="text-sm text-ink-muted hover:text-ink">← Customers</Link>
        <h1 className="mt-1 text-2xl font-medium">Add customer</h1>
      </div>
      <CustomerForm />
    </div>
  );
}
