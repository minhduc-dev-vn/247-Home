import { LoaderCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

export function Loading({
  className,
  label = 'Đang tải...',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        'flex min-h-24 items-center justify-center gap-2 text-sm text-[var(--muted)]',
        className,
      )}
      role="status"
    >
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
