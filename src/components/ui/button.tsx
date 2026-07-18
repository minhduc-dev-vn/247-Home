import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      intent: {
        primary:
          'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]',
        accent:
          'bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]',
        secondary:
          'border-[var(--border)] bg-[var(--surface)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]',
        danger: 'bg-[var(--error)] text-white hover:bg-[#982929]',
        ghost:
          'bg-transparent text-[var(--foreground)] hover:bg-[var(--secondary)]',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5',
        icon: 'size-10 p-0',
      },
    },
    defaultVariants: { intent: 'primary', size: 'default' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({
  children,
  className,
  disabled,
  intent,
  loading = false,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ intent, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

export function PrimaryButton(props: ButtonProps) {
  return <Button intent="primary" {...props} />;
}

export function SecondaryButton(props: ButtonProps) {
  return <Button intent="secondary" {...props} />;
}

export function DangerButton(props: ButtonProps) {
  return <Button intent="danger" {...props} />;
}
