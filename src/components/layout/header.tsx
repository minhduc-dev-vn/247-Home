import { House } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Container } from '@/components/layout/container';
import { Navbar, type NavigationItem } from '@/components/navigation/navbar';

export function Header({
  actions,
  navigation = [],
}: {
  actions?: ReactNode;
  navigation?: readonly NavigationItem[];
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-[var(--surface)]/95 backdrop-blur-sm">
      <Container className="flex min-h-16 items-center gap-3">
        <Link
          aria-label="247 Home - Trang chủ"
          className="inline-flex shrink-0 items-center gap-2 font-bold text-[var(--primary)]"
          href="/"
        >
          <span className="grid size-9 place-items-center rounded-md bg-[var(--primary)] text-white">
            <House aria-hidden="true" className="size-5" />
          </span>
          <span>247 Home</span>
        </Link>
        {navigation.length ? (
          <div className="ml-2 hidden min-w-0 overflow-x-auto md:block">
            <Navbar items={navigation} />
          </div>
        ) : null}
        {actions ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {actions}
          </div>
        ) : null}
      </Container>
      {navigation.length ? (
        <Container className="overflow-x-auto border-t py-1 md:hidden">
          <Navbar items={navigation} />
        </Container>
      ) : null}
    </header>
  );
}
