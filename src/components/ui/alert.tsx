import { AlertCircle, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

const alertStyles = {
  error: 'border-[#efc4c4] bg-[var(--error-soft)] text-[#7f2424]',
  info: 'border-[#c6daf3] bg-[var(--info-soft)] text-[#1f5289]',
  success: 'border-[#bee4ce] bg-[var(--success-soft)] text-[#115e3b]',
  warning: 'border-[#eed3a4] bg-[var(--warning-soft)] text-[#794700]',
} as const;

const alertIcons = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: CircleAlert,
};

export function Alert({
  children,
  className,
  title,
  variant = 'info',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title?: string;
  variant?: keyof typeof alertStyles;
  children: ReactNode;
}) {
  const Icon = alertIcons[variant];
  return (
    <div
      className={cn(
        'motion-feedback flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
        alertStyles[variant],
        className,
      )}
      role={variant === 'error' ? 'alert' : 'status'}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && 'mt-1')}>{children}</div>
      </div>
    </div>
  );
}
