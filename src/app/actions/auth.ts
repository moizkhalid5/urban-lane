"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  createToken,
  consumeToken,
  TOKEN_EMAIL_VERIFY,
  TOKEN_PASSWORD_RESET,
} from "@/lib/auth/tokens";
import { registerSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { verifyEmailTemplate, passwordResetTemplate } from "@/lib/email/templates";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export type FormResult = { ok: boolean; message: string };

export async function registerUser(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const limit = rateLimit(await clientKey("register"), 5, 15 * 60 * 1000);
  if (!limit.ok) return { ok: false, message: "Too many attempts. Please try again later." };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptsMarketing: formData.get("acceptsMarketing") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your details." };
  }
  const { name, email, password, acceptsMarketing } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Don't reveal too much, but guide the user.
    return { ok: false, message: "An account with this email already exists. Please log in." };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role: "CUSTOMER",
      profile: { create: { acceptsMarketing } },
    },
  });

  const token = await createToken(user.id, TOKEN_EMAIL_VERIFY, 60 * 24);
  const url = `${APP_URL}/verify-email?token=${token}`;
  await sendEmail({ to: email, ...verifyEmailTemplate(name, url) });

  return {
    ok: true,
    message: "Account created! Check your email to verify your address before logging in.",
  };
}

export async function resendVerification(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    const token = await createToken(user.id, TOKEN_EMAIL_VERIFY, 60 * 24);
    await sendEmail({ to: email, ...verifyEmailTemplate(user.name ?? "", `${APP_URL}/verify-email?token=${token}`) });
  }
  return { ok: true, message: "If that account exists and is unverified, a new verification email has been sent." };
}

export async function forgotPassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const limit = rateLimit(await clientKey("forgot"), 5, 15 * 60 * 1000);
  if (!limit.ok) return { ok: false, message: "Too many requests. Please try again later." };

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = await createToken(user.id, TOKEN_PASSWORD_RESET, 60);
    const url = `${APP_URL}/reset-password?token=${token}`;
    await sendEmail({ to: user.email, ...passwordResetTemplate(user.name ?? "", url) });
  }
  // Always succeed to avoid leaking which emails are registered.
  return { ok: true, message: "If an account exists for that email, a reset link has been sent." };
}

export async function resetPassword(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const userId = await consumeToken(parsed.data.token, TOKEN_PASSWORD_RESET);
  if (!userId) return { ok: false, message: "This reset link is invalid or has expired." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      // Proving email access also verifies the address.
      emailVerified: new Date(),
    },
  });

  return { ok: true, message: "Your password has been reset. You can now log in." };
}
