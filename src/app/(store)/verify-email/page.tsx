import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { verifyEmailToken } from "@/lib/auth/verify-email";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailToken(token) : { ok: false };

  if (result.ok) {
    return (
      <AuthShell title="Email verified" subtitle={`Welcome${result.name ? `, ${result.name}` : ""}! Your account is now active.`}>
        <Link href="/login" className="btn-primary w-full">Log in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Verification failed" subtitle="This verification link is invalid or has expired.">
      <Link href="/login" className="btn-primary w-full">Back to login</Link>
    </AuthShell>
  );
}
