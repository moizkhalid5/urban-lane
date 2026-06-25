import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-ink-muted">404</p>
      <h1 className="mt-4 text-3xl font-medium">Page not found</h1>
      <p className="mt-2 text-ink-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="btn-primary mt-8">Back to home</Link>
    </div>
  );
}
