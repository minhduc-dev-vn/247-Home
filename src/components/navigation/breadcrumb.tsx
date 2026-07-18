import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export type BreadcrumbItem = { href?: string; label: string };

export function Breadcrumb({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-[var(--muted)]">
        {items.map((item, index) => (
          <li
            className="flex items-center gap-1"
            key={`${item.label}-${index}`}
          >
            {index > 0 ? (
              <ChevronRight aria-hidden="true" className="size-4" />
            ) : null}
            {item.href ? (
              <Link
                className="font-medium hover:text-[var(--primary)]"
                href={item.href}
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
