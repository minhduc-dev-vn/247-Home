import {
  AppointmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { Check, Circle, Clock3, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'error' | 'info' | 'success' | 'warning';

type StatusPresentation = {
  description: string;
  label: string;
  variant: BadgeVariant;
};

export const orderStatusPresentation: Record<OrderStatus, StatusPresentation> =
  {
    PENDING_CONFIRMATION: {
      label: 'Chờ xác nhận',
      description: '247 Home đang kiểm tra thông tin đơn hàng và thanh toán.',
      variant: 'warning',
    },
    CONFIRMED: {
      label: 'Đã xác nhận',
      description: 'Đơn hàng đã được xác nhận và sẵn sàng xử lý.',
      variant: 'info',
    },
    PROCESSING: {
      label: 'Đang chuẩn bị',
      description: 'Thiết bị và dịch vụ đang được chuẩn bị.',
      variant: 'info',
    },
    READY_FOR_INSTALLATION: {
      label: 'Sẵn sàng lắp đặt',
      description: 'Thiết bị đã sẵn sàng cho lịch lắp đặt.',
      variant: 'success',
    },
    INSTALLATION_IN_PROGRESS: {
      label: 'Đang lắp đặt',
      description: 'Kỹ thuật viên đang thực hiện công việc lắp đặt.',
      variant: 'info',
    },
    COMPLETED: {
      label: 'Hoàn thành',
      description: 'Đơn hàng và công việc liên quan đã hoàn tất.',
      variant: 'success',
    },
    CANCELLED: {
      label: 'Đã hủy',
      description: 'Đơn hàng đã kết thúc theo trạng thái hủy.',
      variant: 'error',
    },
  };

export const paymentStatusPresentation: Record<
  PaymentStatus,
  StatusPresentation
> = {
  CREATED: {
    label: 'Đã tạo thanh toán',
    description: 'Phiên thanh toán đang được chuẩn bị.',
    variant: 'info',
  },
  PENDING: {
    label: 'Chờ thanh toán',
    description: 'Thanh toán chưa được xác nhận.',
    variant: 'warning',
  },
  PROCESSING: {
    label: 'Đang thanh toán',
    description: 'Cổng thanh toán đang xử lý giao dịch.',
    variant: 'warning',
  },
  PAID: {
    label: 'Đã thanh toán',
    description: 'Thanh toán đã được xác nhận.',
    variant: 'success',
  },
  FAILED: {
    label: 'Thanh toán thất bại',
    description: 'Thanh toán chưa thể hoàn tất.',
    variant: 'error',
  },
  REFUNDED: {
    label: 'Đã hoàn tiền',
    description: 'Khoản thanh toán đã được hoàn lại.',
    variant: 'info',
  },
  CANCELLED: {
    label: 'Đã hủy thanh toán',
    description: 'Khoản thanh toán không còn hiệu lực.',
    variant: 'default',
  },
};

export const appointmentStatusPresentation: Record<
  AppointmentStatus,
  StatusPresentation
> = {
  SCHEDULED: {
    label: 'Đã giữ lịch',
    description: 'Khung giờ lắp đặt đã được giữ.',
    variant: 'info',
  },
  ASSIGNMENT_PENDING: {
    label: 'Đang phân công',
    description: 'Đội vận hành đang phân công kỹ thuật viên phù hợp.',
    variant: 'warning',
  },
  ASSIGNED: {
    label: 'Đã phân công',
    description: 'Lịch đã có kỹ thuật viên phụ trách.',
    variant: 'info',
  },
  CONFIRMED: {
    label: 'Đã xác nhận lịch',
    description: 'Lịch lắp đặt đã được xác nhận.',
    variant: 'info',
  },
  EN_ROUTE: {
    label: 'Đang di chuyển',
    description: 'Kỹ thuật viên đang trên đường đến địa điểm lắp đặt.',
    variant: 'info',
  },
  ARRIVED: {
    label: 'Đã đến nơi',
    description: 'Kỹ thuật viên đã đến địa điểm lắp đặt.',
    variant: 'info',
  },
  IN_PROGRESS: {
    label: 'Đang thực hiện',
    description: 'Công việc lắp đặt đang được thực hiện.',
    variant: 'info',
  },
  COMPLETED: {
    label: 'Đã hoàn thành',
    description: 'Công việc lắp đặt đã hoàn tất.',
    variant: 'success',
  },
  RESCHEDULE_REQUIRED: {
    label: 'Cần đổi lịch',
    description: 'Đội vận hành cần sắp xếp một khung giờ mới.',
    variant: 'warning',
  },
  CANCELLED: {
    label: 'Lịch đã hủy',
    description: 'Lịch lắp đặt không còn hiệu lực.',
    variant: 'error',
  },
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Chuyển khoản thủ công',
  COD: 'Thanh toán khi nhận hàng',
  VNPAY: 'Thanh toán trực tuyến VNPay',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const presentation = orderStatusPresentation[status];
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const presentation = paymentStatusPresentation[status];
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  const presentation = appointmentStatusPresentation[status];
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}

const orderProgress = [
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.READY_FOR_INSTALLATION,
  OrderStatus.INSTALLATION_IN_PROGRESS,
  OrderStatus.COMPLETED,
] as const;

type TimelineState = 'complete' | 'current' | 'upcoming';

function TimelineItem({
  description,
  label,
  last,
  state,
}: {
  description: string;
  label: string;
  last: boolean;
  state: TimelineState;
}) {
  const Icon =
    state === 'complete' ? Check : state === 'current' ? Clock3 : Circle;
  return (
    <li className="relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      {!last ? (
        <span
          aria-hidden="true"
          className={cn(
            'motion-timeline-line absolute top-7 bottom-0 left-[0.9375rem] w-px',
            state === 'complete' ? 'bg-[var(--success)]' : 'bg-[var(--border)]',
          )}
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          'motion-timeline-node relative z-10 grid size-8 place-items-center rounded-full border bg-[var(--surface)]',
          state === 'complete' &&
            'border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]',
          state === 'current' &&
            'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]',
          state === 'upcoming' && 'text-[var(--muted)]',
        )}
        data-current={state === 'current' ? 'true' : undefined}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 pt-1">
        <p
          className={cn(
            'font-semibold',
            state === 'upcoming' && 'text-[var(--muted)]',
          )}
        >
          {label}
        </p>
        {state !== 'upcoming' ? (
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === OrderStatus.CANCELLED) {
    const presentation = orderStatusPresentation[status];
    return (
      <div
        className="flex items-start gap-3 rounded-md border border-[var(--error)] bg-[var(--error-soft)] p-4"
        data-testid="order-status-timeline"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--error)]">
          <X aria-hidden="true" className="size-4" />
        </span>
        <div>
          <p className="font-semibold">{presentation.label}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {presentation.description}
          </p>
        </div>
      </div>
    );
  }

  const currentIndex = orderProgress.indexOf(status);
  return (
    <ol data-testid="order-status-timeline">
      {orderProgress.map((item, index) => {
        const presentation = orderStatusPresentation[item];
        return (
          <TimelineItem
            description={presentation.description}
            key={item}
            label={presentation.label}
            last={index === orderProgress.length - 1}
            state={
              index < currentIndex
                ? 'complete'
                : index === currentIndex
                  ? 'current'
                  : 'upcoming'
            }
          />
        );
      })}
    </ol>
  );
}

const installationProgress = [
  {
    label: 'Đã giữ lịch',
    statuses: [AppointmentStatus.SCHEDULED] as const,
  },
  {
    label: 'Đang phân công',
    statuses: [AppointmentStatus.ASSIGNMENT_PENDING] as const,
  },
  {
    label: 'Đã phân công',
    statuses: [
      AppointmentStatus.ASSIGNED,
      AppointmentStatus.CONFIRMED,
    ] as const,
  },
  {
    label: 'Đang di chuyển',
    statuses: [AppointmentStatus.EN_ROUTE] as const,
  },
  { label: 'Đã đến nơi', statuses: [AppointmentStatus.ARRIVED] as const },
  {
    label: 'Đang lắp đặt',
    statuses: [AppointmentStatus.IN_PROGRESS] as const,
  },
  { label: 'Hoàn thành', statuses: [AppointmentStatus.COMPLETED] as const },
] as const;

export function InstallationTimeline({
  status,
}: {
  status: AppointmentStatus;
}) {
  const exceptional =
    status === AppointmentStatus.CANCELLED ||
    status === AppointmentStatus.RESCHEDULE_REQUIRED;
  const currentIndex = installationProgress.findIndex(({ statuses }) =>
    (statuses as readonly AppointmentStatus[]).includes(status),
  );

  return (
    <div data-testid="installation-timeline">
      {exceptional ? (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-md border bg-[var(--surface-subtle)] p-4">
          <div>
            <p className="font-semibold">
              {appointmentStatusPresentation[status].label}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {appointmentStatusPresentation[status].description}
            </p>
          </div>
          <AppointmentStatusBadge status={status} />
        </div>
      ) : null}
      {!exceptional ? (
        <ol>
          {installationProgress.map((item, index) => (
            <TimelineItem
              description={
                appointmentStatusPresentation[item.statuses[0]].description
              }
              key={item.label}
              label={item.label}
              last={index === installationProgress.length - 1}
              state={
                index < currentIndex
                  ? 'complete'
                  : index === currentIndex
                    ? 'current'
                    : 'upcoming'
              }
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}
