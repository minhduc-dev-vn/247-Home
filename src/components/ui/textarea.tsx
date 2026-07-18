import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'min-h-24 w-full resize-y rounded-md border bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-sm transition-colors outline-none placeholder:text-[var(--muted)] hover:border-[#b7c5cb] focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--primary-soft)] disabled:cursor-not-allowed disabled:bg-[var(--surface-subtle)] disabled:opacity-70',
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
