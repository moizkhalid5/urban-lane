"use server";

import { prisma } from "@/lib/prisma";
import { newsletterSchema } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { newsletterWelcomeTemplate } from "@/lib/email/templates";

export type ActionState = { ok: boolean; message: string };

/** Subscribe an email to the newsletter; sends a confirmation/welcome email. */
export async function subscribeNewsletter(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newsletterSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  const { email } = parsed.data;

  await prisma.newsletterSubscriber.upsert({
    where: { email },
    update: { isActive: true },
    create: { email },
  });

  const tpl = newsletterWelcomeTemplate();
  await sendEmail({ to: email, ...tpl });

  return { ok: true, message: "Thank you for subscribing! Check your inbox for a welcome email." };
}
