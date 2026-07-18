import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    className={cn(
      'h-10 w-full rounded-md border bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] shadow-sm transition-colors outline-none placeholder:text-[var(--muted)] hover:border-[#b7c5cb] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:opacity-70',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
