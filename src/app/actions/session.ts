"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { mergeGuestCartIntoUser } from "@/lib/cart-merge";
import { mergeGuestWishlistIntoUser } from "@/lib/wishlist";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export type LoginResult = { ok: boolean; message: string };

export async function loginUser(_prev: LoginResult, formData: FormData): Promise<LoginResult> {
  const limit = rateLimit(await clientKey("login"), 8, 5 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, message: "Enter your email and password." };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Distinguish "unverified email" from "wrong credentials" for a helpful message.
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (user && !user.emailVerified) {
        return { ok: false, message: "Please verify your email address before logging in." };
      }
      return { ok: false, message: "Invalid email or password." };
    }
    throw err;
  }

  // Successful login — merge any guest cart and wishlist into the user's account.
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    await mergeGuestCartIntoUser(user.id);
    await mergeGuestWishlistIntoUser(user.id);
  }

  return { ok: true, message: "Logged in." };
}

export async function logoutUser() {
  await signOut({ redirectTo: "/" });
}
