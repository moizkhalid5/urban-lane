import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  // payment
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  REFUNDED: "bg-gray-100 text-gray-700 border-gray-200",
  PARTIALLY_REFUNDED: "bg-gray-100 text-gray-700 border-gray-200",
  // fulfillment
  UNFULFILLED: "bg-gray-100 text-gray-700 border-gray-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  SHIPPED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  DELIVERED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  RETURNED: "bg-orange-50 text-orange-700 border-orange-200",
  // reviews
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  HIDDEN: "bg-gray-100 text-gray-700 border-gray-200",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200",
      )}
    >
      {label}
    </span>
  );
}
