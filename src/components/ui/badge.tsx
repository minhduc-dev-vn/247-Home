import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const badgeStyles = {
  default: 'bg-[var(--secondary)] text-[var(--secondary-foreground)]',
  error: 'bg-[var(--error-soft)] text-[var(--error)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
} as const;

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof badgeStyles;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-sm px-2 py-0.5 text-xs font-semibold transition-[color,background-color,transform] duration-200 ease-out',
        badgeStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
