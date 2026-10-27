import { redirect } from "next/navigation";

/** The wishlist moved to /wishlist, which works without logging in. */
export default function AccountWishlistPage() {
  redirect("/wishlist");
}
