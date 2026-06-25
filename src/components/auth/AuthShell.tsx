export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container-site flex justify-center py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <div className="border border-line p-8">{children}</div>
      </div>
    </div>
  );
}
