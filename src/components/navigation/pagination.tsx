import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Pagination({
  label = 'Trang hiện tại',
  nextHref,
  previousHref,
}: {
  label?: string;
  nextHref?: string;
  previousHref?: string;
}) {
  const itemClass = cn(buttonVariants({ intent: 'secondary', size: 'sm' }));
  return (
    <nav
      aria-label="Phân trang"
      className="flex items-center justify-between gap-4"
    >
      {previousHref ? (
        <Link className={itemClass} href={previousHref}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Trước
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(itemClass, 'opacity-50')}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Trước
        </span>
      )}
      <span className="text-sm text-[var(--muted)]">{label}</span>
      {nextHref ? (
        <Link className={itemClass} href={nextHref}>
          Sau
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(itemClass, 'opacity-50')}>
          Sau
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      )}
    </nav>
  );
}
