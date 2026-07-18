import { Badge } from '@/components/ui/badge';

type BadgeVariant = 'default' | 'error' | 'info' | 'success' | 'warning';
type StatusMeta = { label: string; variant: BadgeVariant };

export const operationsOrderStatuses = {
  PENDING_CONFIRMATION: { label: 'Chờ xác nhận', variant: 'warning' },
  CONFIRMED: { label: 'Đã xác nhận', variant: 'info' },
  PROCESSING: { label: 'Đang chuẩn bị', variant: 'info' },
  READY_FOR_INSTALLATION: {
    label: 'Sẵn sàng lắp đặt',
    variant: 'success',
  },
  INSTALLATION_IN_PROGRESS: { label: 'Đang lắp đặt', variant: 'info' },
  COMPLETED: { label: 'Hoàn thành', variant: 'success' },
  CANCELLED: { label: 'Đã hủy', variant: 'error' },
} as const satisfies Record<string, StatusMeta>;

export const operationsAppointmentStatuses = {
  SCHEDULED: { label: 'Đã giữ lịch', variant: 'info' },
  ASSIGNMENT_PENDING: { label: 'Chờ phân công', variant: 'warning' },
  ASSIGNED: { label: 'Đã phân công', variant: 'info' },
  CONFIRMED: { label: 'Đã xác nhận lịch', variant: 'info' },
  EN_ROUTE: { label: 'Đang di chuyển', variant: 'info' },
  ARRIVED: { label: 'Đã đến nơi', variant: 'info' },
  IN_PROGRESS: { label: 'Đang thực hiện', variant: 'info' },
  COMPLETED: { label: 'Đã hoàn thành', variant: 'success' },
  RESCHEDULE_REQUIRED: { label: 'Cần đổi lịch', variant: 'warning' },
  CANCELLED: { label: 'Lịch đã hủy', variant: 'error' },
} as const satisfies Record<string, StatusMeta>;

export const operationsWarrantyStatuses = {
  SUBMITTED: { label: 'Mới tiếp nhận', variant: 'warning' },
  IN_REVIEW: { label: 'Đang xem xét', variant: 'info' },
  RESOLVED: { label: 'Đã xử lý', variant: 'success' },
  CLOSED: { label: 'Đã đóng', variant: 'default' },
  REJECTED: { label: 'Bị từ chối', variant: 'error' },
} as const satisfies Record<string, StatusMeta>;

export type OperationsStatusKind = 'appointment' | 'order' | 'warranty';

export function getOperationsStatusMeta(
  kind: OperationsStatusKind,
  status: string,
): StatusMeta {
  const maps: Record<OperationsStatusKind, Record<string, StatusMeta>> = {
    appointment: operationsAppointmentStatuses,
    order: operationsOrderStatuses,
    warranty: operationsWarrantyStatuses,
  };
  return maps[kind][status] ?? { label: status, variant: 'default' };
}

export function OperationsStatusBadge({
  kind,
  status,
}: {
  kind: OperationsStatusKind;
  status: string;
}) {
  const meta = getOperationsStatusMeta(kind, status);
  return (
    <Badge variant={meta.variant}>
      {meta.label}
      <span className="sr-only"> ({status})</span>
    </Badge>
  );
}
