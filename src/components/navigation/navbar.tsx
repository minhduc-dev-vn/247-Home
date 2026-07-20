'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type NavigationItem = {
  href: string;
  icon?: ReactNode;
  label: string;
};

export function Navbar({
  ariaLabel = 'Điều hướng chính',
  className,
  items,
}: {
  ariaLabel?: string;
  className?: string;
  items: readonly NavigationItem[];
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const itemPath = item.href.split('#')[0] || '/';
          const active =
            itemPath === '/'
              ? pathname === '/'
              : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
          return (
            <li key={`${item.href}-${item.label}`}>
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'motion-nav-link inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]',
                  active && 'text-[var(--foreground)]',
                )}
                href={item.href}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
