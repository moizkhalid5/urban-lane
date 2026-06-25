import "server-only";
import { prisma } from "@/lib/prisma";
import { consumeToken, TOKEN_EMAIL_VERIFY } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email";
import { welcomeTemplate } from "@/lib/email/templates";

/**
 * Consume an email-verification token, mark the account verified, and send the
 * welcome email. Plain server-side function (not a Server Action) — it's invoked
 * from the /verify-email page on GET.
 */
export async function verifyEmailToken(token: string): Promise<{ ok: boolean; name?: string }> {
  const userId = await consumeToken(token, TOKEN_EMAIL_VERIFY);
  if (!userId) return { ok: false };
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
  await sendEmail({ to: user.email, ...welcomeTemplate(user.name ?? "") });
  return { ok: true, name: user.name ?? undefined };
}
