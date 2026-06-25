import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const TOKEN_EMAIL_VERIFY = "EMAIL_VERIFY";
export const TOKEN_PASSWORD_RESET = "PASSWORD_RESET";

/** Create a single-use token of the given type, valid for `ttlMinutes`. */
export async function createToken(userId: string, type: string, ttlMinutes: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  // Invalidate any prior unused tokens of the same type for this user.
  await prisma.token.deleteMany({ where: { userId, type, usedAt: null } });
  await prisma.token.create({ data: { userId, type, token, expiresAt } });
  return token;
}

/** Validate + consume a token. Returns the userId on success, or null. */
export async function consumeToken(token: string, type: string): Promise<string | null> {
  const record = await prisma.token.findUnique({ where: { token } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }
  await prisma.token.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return record.userId;
}
