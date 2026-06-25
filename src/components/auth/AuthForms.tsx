"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginUser, type LoginResult } from "@/app/actions/session";
import { registerUser, forgotPassword, resetPassword, type FormResult } from "@/app/actions/auth";

const initLogin: LoginResult = { ok: false, message: "" };
const initForm: FormResult = { ok: false, message: "" };

function Alert({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className={`border p-3 text-sm ${ok ? "border-success/40 bg-success/5 text-success" : "border-sale/40 bg-sale/5 text-sale"}`}>
      {children}
    </p>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginUser, initLogin);
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/account";

  useEffect(() => {
    if (state.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }, [state.ok, callbackUrl, router]);

  return (
    <form action={action} className="space-y-4">
      <Alert ok={state.ok}>{state.message}</Alert>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-ink-muted hover:text-ink">Forgot password?</Link>
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-ink-muted">
        New here?{" "}
        <Link href="/register" className="text-ink underline">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerUser, initForm);
  return (
    <form action={action} className="space-y-4">
      <Alert ok={state.ok}>{state.message}</Alert>
      {!state.ok && (
        <>
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" name="name" required className="input" autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="input" autoComplete="new-password" />
            <p className="mt-1 text-xs text-ink-muted">At least 8 characters, with an uppercase letter and a number.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" name="acceptsMarketing" className="h-4 w-4 accent-ink" />
            Email me about new arrivals and offers
          </label>
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Creating account…" : "Create account"}
          </button>
        </>
      )}
      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline">Log in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, initForm);
  return (
    <form action={action} className="space-y-4">
      <Alert ok={state.ok}>{state.message}</Alert>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-ink-muted">
        <Link href="/login" className="text-ink underline">Back to login</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, initForm);
  return (
    <form action={action} className="space-y-4">
      <Alert ok={state.ok}>{state.message}</Alert>
      <input type="hidden" name="token" value={token} />
      {state.ok ? (
        <Link href="/login" className="btn-primary w-full">Go to login</Link>
      ) : (
        <>
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input id="password" name="password" type="password" required className="input" autoComplete="new-password" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Resetting…" : "Reset password"}
          </button>
        </>
      )}
    </form>
  );
}
