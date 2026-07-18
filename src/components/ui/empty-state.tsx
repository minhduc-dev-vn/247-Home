import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function EmptyState({
  action,
  className,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  className?: string;
  description?: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center',
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
        {icon ?? <Inbox aria-hidden="true" className="size-5" />}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
