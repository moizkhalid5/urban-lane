import Link from "next/link";

export type Crumb = { name: string; href: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            <span aria-hidden>/</span>
            {i === items.length - 1 ? (
              <span className="text-ink">{c.name}</span>
            ) : (
              <Link href={c.href} className="hover:text-ink">
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
