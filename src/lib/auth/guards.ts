import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";

/** Returns the current session user or null. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Require any authenticated user; redirects to /login otherwise. */
export async function requireUser(callbackUrl?: string) {
  const user = await getCurrentUser();
  if (!user) {
    const cb = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
    redirect(`/login${cb}`);
  }
  return user;
}

/** Require an admin or staff role; redirects unauthorized users. */
export async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "ADMIN" && user.role !== "STAFF") redirect("/");
  return user;
}

/** Require the ADMIN role specifically. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}

export function hasRole(role: UserRole | undefined, ...allowed: UserRole[]) {
  return role !== undefined && allowed.includes(role);
}
