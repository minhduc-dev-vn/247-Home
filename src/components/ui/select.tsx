import { forwardRef, type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    className={cn(
      'h-10 w-full rounded-md border bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] shadow-sm transition-[border-color,box-shadow,transform] duration-200 outline-none hover:border-[#b7c5cb] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:opacity-70',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Select.displayName = 'Select';
