import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Join Urban Lane for faster checkout and order tracking">
      <RegisterForm />
    </AuthShell>
  );
}
