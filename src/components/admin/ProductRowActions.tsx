"use client";

import Link from "next/link";
import { setProductStatus, deleteProduct } from "@/app/actions/admin-products";
import { ConfirmButton } from "./ConfirmButton";

export function ProductRowActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <Link href={`/admin/products/${id}`} className="text-ink-muted hover:text-ink">
        Edit
      </Link>
      {status !== "ARCHIVED" ? (
        <ConfirmButton
          action={() => setProductStatus(id, "ARCHIVED")}
          confirm="Archive this product? It will be hidden from the store."
          className="text-ink-muted hover:text-ink"
        >
          Archive
        </ConfirmButton>
      ) : (
        <ConfirmButton action={() => setProductStatus(id, "ACTIVE")} className="text-ink-muted hover:text-ink">
          Restore
        </ConfirmButton>
      )}
      <ConfirmButton
        action={() => deleteProduct(id)}
        confirm="Permanently delete this product? This cannot be undone."
        className="text-sale hover:underline"
      >
        Delete
      </ConfirmButton>
    </div>
  );
}
