import type { WarrantyStatus } from '@prisma/client';
import { Check, Circle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const warrantyStatusPresentation = {
  SUBMITTED: { label: 'Đã tiếp nhận', variant: 'info' },
  IN_REVIEW: { label: 'Đang xem xét', variant: 'warning' },
  RESOLVED: { label: 'Đã xử lý', variant: 'success' },
  REJECTED: { label: 'Từ chối bảo hành', variant: 'error' },
  CLOSED: { label: 'Đã đóng', variant: 'default' },
} as const satisfies Record<
  WarrantyStatus,
  {
    label: string;
    variant: 'default' | 'error' | 'info' | 'success' | 'warning';
  }
>;

export const warrantyCoverageLabels = {
  DEVICE: 'Bảo hành thiết bị',
  INSTALLATION: 'Bảo hành lắp đặt',
} as const;

export const warrantyIssueLabels = {
  DEVICE_NOT_WORKING: 'Thiết bị không hoạt động',
  INSTALLATION_QUALITY: 'Chất lượng lắp đặt',
  PHYSICAL_DAMAGE: 'Hư hỏng vật lý',
  OTHER: 'Vấn đề khác',
} as const;

export function warrantyTimelineStates(
  status: WarrantyStatus,
): WarrantyStatus[] {
  return status === 'REJECTED'
    ? ['SUBMITTED', 'IN_REVIEW', 'REJECTED', 'CLOSED']
    : ['SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'CLOSED'];
}

export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  const presentation = warrantyStatusPresentation[status];
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}

export function WarrantyTimeline({ status }: { status: WarrantyStatus }) {
  const states = warrantyTimelineStates(status);
  const currentIndex = states.indexOf(status);
  return (
    <ol
      aria-label="Tiến trình bảo hành"
      className="grid min-w-[34rem] grid-cols-4 gap-2 sm:min-w-0"
      data-testid="warranty-status-timeline"
    >
      {states.map((state, index) => {
        const reached = index <= currentIndex;
        return (
          <li className="relative min-w-0" key={state}>
            {index ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-4 right-1/2 h-0.5 w-full',
                  reached ? 'bg-[var(--primary)]' : 'bg-[var(--border)]',
                )}
              />
            ) : null}
            <div className="relative flex flex-col items-center text-center">
              <span
                className={cn(
                  'grid size-8 place-items-center rounded-full border bg-[var(--surface)]',
                  reached
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'text-[var(--muted)]',
                )}
              >
                {reached ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : (
                  <Circle aria-hidden="true" className="size-3" />
                )}
              </span>
              <span className="mt-2 text-xs font-semibold">
                {warrantyStatusPresentation[state].label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
