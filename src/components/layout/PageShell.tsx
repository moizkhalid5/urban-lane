export function PageShell({
  title,
  intro,
  children,
  wide = false,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="container-site py-12">
      <div className={wide ? "" : "mx-auto max-w-3xl"}>
        <h1 className="text-3xl font-medium md:text-4xl">{title}</h1>
        {intro && <p className="mt-3 text-ink-muted">{intro}</p>}
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-ink [&_a]:underline">
          {children}
        </div>
      </div>
    </div>
  );
}
