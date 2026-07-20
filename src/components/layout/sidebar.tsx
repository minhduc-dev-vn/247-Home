'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import type { NavigationItem } from '@/components/navigation/navbar';

export function Sidebar({
  footer,
  items,
  label,
}: {
  footer?: ReactNode;
  items: readonly NavigationItem[];
  label: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-[var(--surface)] lg:flex lg:min-h-[calc(100svh-4rem)] lg:flex-col">
      <div className="px-4 py-5">
        <p className="px-3 text-xs font-semibold text-[var(--muted)] uppercase">
          {label}
        </p>
        <nav aria-label={label} className="mt-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={`motion-sidebar-link flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium ${active ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]'}`}
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
      </div>
      {footer ? <div className="mt-auto border-t p-4">{footer}</div> : null}
    </aside>
  );
}
