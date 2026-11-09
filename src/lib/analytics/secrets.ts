import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * The Google key and Clarity token for Admin → Analytics are stored encrypted (AES-256-GCM), with a key made
 * from AUTH_SECRET, so a copy of the database alone doesn't give access to the shop's analytics accounts.
 * Changing AUTH_SECRET means entering them again.
 */
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`analytics:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

/** null if it can't be read (e.g. AUTH_SECRET changed). */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [version, iv, tag, data] = stored.split(".");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
