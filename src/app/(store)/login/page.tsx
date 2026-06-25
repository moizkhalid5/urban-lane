import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Urbane Lane account">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
