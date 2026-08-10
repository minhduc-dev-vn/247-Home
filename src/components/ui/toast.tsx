import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Toast({
  children,
  className,
  onDismiss,
  title,
}: {
  children?: ReactNode;
  className?: string;
  onDismiss?: () => void;
  title: string;
}) {
  return (
    <div
      className={cn(
        'motion-feedback flex w-full max-w-sm items-start gap-3 rounded-md border bg-[var(--surface)] p-4 shadow-[var(--shadow-modal)]',
        className,
      )}
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? (
          <div className="mt-1 text-sm text-[var(--muted)]">{children}</div>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          aria-label="Đóng thông báo"
          className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-[var(--secondary)]"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <div
      aria-label="Thông báo"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 [&>*]:pointer-events-auto"
    >
      {children}
    </div>
  );
}
