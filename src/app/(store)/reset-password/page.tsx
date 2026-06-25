import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Set new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This password reset link is missing or invalid.">
        <Link href="/forgot-password" className="btn-primary w-full">Request a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
