import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    className={cn(
      'size-4 shrink-0 rounded-sm border accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    type="checkbox"
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';
