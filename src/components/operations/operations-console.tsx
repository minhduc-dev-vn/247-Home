'use client';

import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Filter,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Select } from '@/components/ui/select';
import { Table, TableContainer } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  OperationsStatusBadge,
  operationsAppointmentStatuses,
  operationsOrderStatuses,
  operationsWarrantyStatuses,
} from '@/components/operations/operations-presentation';
import { cn } from '@/lib/utils';
import {
  formatServiceDateTime,
  toServiceDate,
} from '@/shared/date/service-time';
import { formatVnd } from '@/shared/money/format-vnd';

type Roles = readonly string[];
type Tab = 'orders' | 'appointments' | 'warranties' | 'audit';
type ApiError = { error?: { code?: string; message?: string } };
type Page<T> = { items: T[]; nextCursor: string | null };
type PagedState<T> = {
  data: Page<T> | null;
  loading: boolean;
  error: string | null;
  cursors: string[];
  index: number;
};
type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  grandTotal: string;
  createdAt: string;
  appointment: { id: string; status: string } | null;
};
type Assignment = {
  id: string;
  technicianId: string;
  technician: { user: { name: string } };
  status: string;
};
type AppointmentRow = {
  id: string;
  slotId: string;
  status: string;
  version: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  serviceArea: {
    id: string;
    code: string;
    provinceName: string;
    districtName: string;
  };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    recipientName: string;
  };
  assignments: Assignment[];
};
type WarrantyRow = {
  id: string;
  requestNumber: string;
  status: string;
  issueType: string;
  createdAt: string;
  orderItem: { order: { id: string; orderNumber: string; status: string } };
};
type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
  actor: { email: string; name: string };
};
type OrderDetail = OrderRow & {
  version: number;
  recipientName: string;
  addressLine1: string;
  wardName: string;
  districtName: string;
  provinceName: string;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    quantity: number;
    lineTotal: string;
  }>;
  payment: { method: string; status: string } | null;
  appointment: AppointmentRow | null;
};
type WarrantyDetail = {
  id: string;
  requestNumber: string;
  status: string;
  issueType: string;
  description: string;
  submittedAt: string;
  customer: { name: string };
  orderItem: {
    productName: string;
    variantName: string;
    order: {
      id: string;
      orderNumber: string;
      status: string;
      appointment: {
        id: string;
        status: string;
        scheduledStartAt: string;
        scheduledEndAt: string;
      } | null;
    };
  };
};
type OrderAction = { action: string; label: string };
type Slot = { id: string; startsAt: string; endsAt: string; available: number };
type ConfirmAction = {
  title: string;
  description: string;
  execute: () => Promise<void>;
};

const orderStatuses = Object.entries(operationsOrderStatuses);
const appointmentStatuses = Object.entries(operationsAppointmentStatuses);
const warrantyStatuses = Object.entries(operationsWarrantyStatuses);

function errorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    payload.error &&
    typeof payload.error === 'object' &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  )
    return payload.error.message;
  return fallback;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json()) as { data?: T } & ApiError;
  if (!response.ok || !body.data)
    throw new Error(errorMessage(body, 'Khong the tai du lieu.'));
  return body.data;
}

function formatDate(value: string) {
  return formatServiceDateTime(value);
}

function formatMoney(value: string) {
  return formatVnd(value);
}

function currentDate(value: string) {
  return toServiceDate(value);
}

function usePagedResource<T>(
  endpoint: string,
  enabled: boolean,
  filterValue: string,
  filterKey = 'status',
) {
  const requestSequence = useRef(0);
  const [state, setState] = useState<PagedState<T>>({
    data: null,
    loading: false,
    error: null,
    cursors: [''],
    index: 0,
  });
  const load = useCallback(
    async (cursor = '', direction: 'reset' | 'next' | 'previous' = 'reset') => {
      const sequence = ++requestSequence.current;
      setState((previous) => ({ ...previous, loading: true, error: null }));
      const params = new URLSearchParams({ limit: '10' });
      if (cursor) params.set('cursor', cursor);
      if (filterValue) params.set(filterKey, filterValue);
      try {
        const data = await request<Page<T>>(`${endpoint}?${params.toString()}`);
        setState((previous) => {
          if (sequence !== requestSequence.current) return previous;
          const cursors =
            direction === 'next'
              ? [...previous.cursors.slice(0, previous.index + 1), cursor]
              : direction === 'previous'
                ? previous.cursors
                : [''];
          const index =
            direction === 'next'
              ? cursors.length - 1
              : direction === 'previous'
                ? Math.max(0, previous.index - 1)
                : 0;
          return { data, loading: false, error: null, cursors, index };
        });
      } catch (error: unknown) {
        setState((previous) => {
          if (sequence !== requestSequence.current) return previous;
          return {
            ...previous,
            loading: false,
            error:
              error instanceof Error ? error.message : 'Khong the tai du lieu.',
          };
        });
      }
    },
    [endpoint, filterKey, filterValue],
  );
  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);
  return {
    ...state,
    refresh: () => load(),
    next: () => state.data?.nextCursor && load(state.data.nextCursor, 'next'),
    previous: () =>
      state.index > 0 && load(state.cursors[state.index - 1], 'previous'),
  };
}

function Dialog({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const titleId = useId();
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <section
        aria-modal="true"
        aria-labelledby={titleId}
        className="motion-dialog max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border bg-[var(--surface)] shadow-[var(--shadow-modal)]"
        role="dialog"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-[var(--surface)] px-5 py-4">
          <h2 className="text-lg font-bold" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="Dong"
            className="ml-auto grid size-9 place-items-center rounded-md hover:bg-[var(--secondary)]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-5 sm:p-6">{children}</div>
      </section>
    </div>
  );
}

function Pager({
  next,
  previous,
  disabledNext,
  disabledPrevious,
}: {
  next: () => void;
  previous: () => void;
  disabledNext: boolean;
  disabledPrevious: boolean;
}) {
  return (
    <nav
      aria-label="Phan trang"
      className="flex items-center justify-end gap-2 border-t px-4 py-3"
    >
      <Button
        aria-label="Trang truoc"
        disabled={disabledPrevious}
        intent="secondary"
        onClick={previous}
        size="sm"
        type="button"
      >
        <ArrowLeft size={16} />
      </Button>
      <Button
        aria-label="Trang sau"
        disabled={disabledNext}
        intent="secondary"
        onClick={next}
        size="sm"
        type="button"
      >
        <ArrowRight size={16} />
      </Button>
    </nav>
  );
}

function QueueState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  children: ReactNode;
}) {
  if (loading)
    return <Loading className="min-h-52" label="Đang tải dữ liệu..." />;
  if (error)
    return (
      <Alert className="m-4" title="Không thể tải dữ liệu" variant="error">
        {error}
      </Alert>
    );
  if (empty)
    return (
      <EmptyState
        className="min-h-52"
        description="Thử thay đổi bộ lọc hoặc tải lại dữ liệu."
        title="Không có dữ liệu phù hợp"
      />
    );
  return <>{children}</>;
}

export function OperationsConsole({ roles }: { roles: Roles }) {
  const [tab, setTab] = useState<Tab>('orders');
  const [orderStatus, setOrderStatus] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentRegion, setAppointmentRegion] = useState('');
  const [warrantyStatus, setWarrantyStatus] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const canManage = roles.includes('MANAGER') || roles.includes('ADMIN');
  const orders = usePagedResource<OrderRow>(
    '/api/v1/admin/operations/orders',
    tab === 'orders',
    orderStatus,
  );
  const appointments = usePagedResource<AppointmentRow>(
    '/api/v1/admin/operations/appointments',
    tab === 'appointments',
    appointmentStatus,
  );
  const warranties = usePagedResource<WarrantyRow>(
    '/api/v1/admin/operations/warranties',
    tab === 'warranties',
    warrantyStatus,
  );
  const audit = usePagedResource<AuditRow>(
    '/api/v1/admin/operations/audit',
    tab === 'audit' && canManage,
    auditAction,
    'action',
  );
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [orderActions, setOrderActions] = useState<OrderAction[]>([]);
  const [orderAudit, setOrderAudit] = useState<AuditRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [warrantyDetail, setWarrantyDetail] = useState<WarrantyDetail | null>(
    null,
  );
  const [actionReason, setActionReason] = useState('');
  const [assignment, setAssignment] = useState<AppointmentRow | null>(null);
  const [technicians, setTechnicians] = useState<
    Array<{ id: string; user: { name: string } }>
  >([]);
  const [technicianNextCursor, setTechnicianNextCursor] = useState<
    string | null
  >(null);
  const [technicianId, setTechnicianId] = useState('');
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [reschedule, setReschedule] = useState<AppointmentRow | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const visibleOrders = useMemo(() => {
    const query = orderSearch.trim().toLocaleLowerCase('vi');
    return (orders.data?.items ?? []).filter(
      (order) =>
        (!query || order.orderNumber.toLocaleLowerCase('vi').includes(query)) &&
        (!orderDate || currentDate(order.createdAt) === orderDate),
    );
  }, [orderDate, orderSearch, orders.data?.items]);

  const visibleAppointments = useMemo(() => {
    const query = appointmentSearch.trim().toLocaleLowerCase('vi');
    const region = appointmentRegion.trim().toLocaleLowerCase('vi');
    return (appointments.data?.items ?? []).filter((appointment) => {
      const searchable =
        `${appointment.order.orderNumber} ${appointment.order.recipientName}`.toLocaleLowerCase(
          'vi',
        );
      const area =
        `${appointment.serviceArea.code} ${appointment.serviceArea.districtName} ${appointment.serviceArea.provinceName}`.toLocaleLowerCase(
          'vi',
        );
      return (
        (!query || searchable.includes(query)) &&
        (!region || area.includes(region))
      );
    });
  }, [appointmentRegion, appointmentSearch, appointments.data?.items]);

  const refreshOperations = useCallback(() => {
    appointments.refresh();
    orders.refresh();
  }, [appointments, orders]);

  const openOrder = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      setOrderDetail(null);
      setOrderActions([]);
      setOrderAudit([]);
      try {
        const [detail, actions, auditEvents] = await Promise.all([
          request<OrderDetail>(`/api/v1/admin/operations/orders/${id}`),
          request<{ actions: OrderAction[] }>(
            `/api/v1/admin/orders/${id}/actions`,
          ),
          canManage
            ? request<Page<AuditRow>>(
                `/api/v1/admin/operations/audit?limit=10&targetId=${id}`,
              )
            : Promise.resolve(null),
        ]);
        setOrderDetail(detail);
        setOrderActions(actions.actions);
        setOrderAudit(auditEvents?.items ?? []);
      } catch (error: unknown) {
        setDetailError(
          error instanceof Error ? error.message : 'Khong the mo don hang.',
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [canManage],
  );

  const loadTechnicians = useCallback(
    async (
      appointment: AppointmentRow,
      cursor?: string,
      search = technicianSearch,
    ) => {
      setAssignmentLoading(true);
      setAssignmentError(null);
      try {
        const params = new URLSearchParams({
          appointmentId: appointment.id,
          limit: '25',
        });
        if (cursor) params.set('cursor', cursor);
        if (search.trim()) params.set('search', search.trim());
        const result = await request<
          Page<{ id: string; user: { name: string } }>
        >(`/api/v1/admin/operations/technicians?${params.toString()}`);
        setTechnicians((current) =>
          cursor ? [...current, ...result.items] : result.items,
        );
        setTechnicianNextCursor(result.nextCursor);
      } catch (error: unknown) {
        setAssignmentError(
          error instanceof Error
            ? error.message
            : 'Khong the tai danh sach ky thuat vien.',
        );
      } finally {
        setAssignmentLoading(false);
      }
    },
    [technicianSearch],
  );

  const openAssignment = useCallback(
    async (appointment: AppointmentRow) => {
      setAssignment(appointment);
      setTechnicians([]);
      setTechnicianNextCursor(null);
      setTechnicianId('');
      setTechnicianSearch('');
      setAssignmentReason('');
      await loadTechnicians(appointment, undefined, '');
    },
    [loadTechnicians],
  );

  const loadSlots = useCallback(
    async (appointment: AppointmentRow, date: string) => {
      setRescheduleLoading(true);
      setRescheduleError(null);
      setSlots([]);
      setSlotId('');
      try {
        const result = await request<Page<Slot>>(
          `/api/v1/installation-slots?${new URLSearchParams({ serviceAreaId: appointment.serviceArea.id, fromDate: date, toDate: date }).toString()}`,
        );
        setSlots(result.items.filter((slot) => slot.id !== appointment.slotId));
      } catch (error: unknown) {
        setRescheduleError(
          error instanceof Error ? error.message : 'Khong the tai khung gio.',
        );
      } finally {
        setRescheduleLoading(false);
      }
    },
    [],
  );

  const openReschedule = useCallback(
    (appointment: AppointmentRow) => {
      const date = currentDate(appointment.scheduledStartAt);
      setReschedule(appointment);
      setRescheduleDate(date);
      setRescheduleReason('');
      setRescheduleError(null);
      void loadSlots(appointment, date);
    },
    [loadSlots],
  );

  const activeTitle = useMemo(
    () =>
      ({
        orders: 'Đơn hàng',
        appointments: 'Lịch lắp đặt',
        warranties: 'Bảo hành',
        audit: 'Nhật ký audit',
      })[tab],
    [tab],
  );
  const tabs: Array<{
    id: Tab;
    label: string;
    visibleLabel: string;
    icon: ReactNode;
  }> = [
    {
      id: 'orders',
      label: 'Don hang',
      visibleLabel: 'Đơn hàng',
      icon: <ClipboardList size={16} />,
    },
    {
      id: 'appointments',
      label: 'Lap dat',
      visibleLabel: 'Lắp đặt',
      icon: <CalendarClock size={16} />,
    },
    {
      id: 'warranties',
      label: 'Bao hanh',
      visibleLabel: 'Bảo hành',
      icon: <FileSearch size={16} />,
    },
    {
      id: 'audit',
      label: 'Audit',
      visibleLabel: 'Audit',
      icon: <ShieldCheck size={16} />,
    },
  ];

  return (
    <main className="mx-auto min-h-0 w-full max-w-[1440px] min-w-0 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Breadcrumb
          items={[{ href: '/admin', label: 'Quản trị' }, { label: 'Vận hành' }]}
        />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              <span className="sr-only">Operations: </span>
              Trung tâm vận hành
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Theo dõi đơn hàng, điều phối lắp đặt và kiểm tra các hoạt động
              quan trọng trong một không gian làm việc thống nhất.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {roles.map((role) => (
              <Badge key={role} variant={canManage ? 'info' : 'default'}>
                {role}
              </Badge>
            ))}
            <Button
              aria-label="Tai lai du lieu Operations"
              intent="secondary"
              onClick={refreshOperations}
              size="icon"
              title="Tải lại dữ liệu"
              type="button"
            >
              <RefreshCw aria-hidden="true" size={17} />
            </Button>
          </div>
        </div>
      </header>

      <section
        aria-label="Tổng quan trang hiện tại"
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {[
          {
            label: 'Đơn đang hiển thị',
            value: orders.data ? orders.data.items.length : '—',
            icon: <PackageCheck aria-hidden="true" size={19} />,
          },
          {
            label: 'Lịch đang hiển thị',
            value: appointments.data ? appointments.data.items.length : '—',
            icon: <CalendarDays aria-hidden="true" size={19} />,
          },
          {
            label: 'Chờ phân công',
            value: appointments.data
              ? appointments.data.items.filter(
                  (item) => item.status === 'ASSIGNMENT_PENDING',
                ).length
              : '—',
            icon: <Users aria-hidden="true" size={19} />,
          },
          {
            label: 'Bảo hành hiển thị',
            value: warranties.data ? warranties.data.items.length : '—',
            icon: <Wrench aria-hidden="true" size={19} />,
          },
        ].map((metric) => (
          <Card
            className="motion-card-interactive min-w-0"
            data-testid="operations-metric"
            key={metric.label}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                {metric.icon}
              </span>
              <span className="min-w-0">
                <strong className="block text-xl">{metric.value}</strong>
                <span className="block text-xs text-[var(--muted)]">
                  {metric.label}
                </span>
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <div
        className="mt-6 flex gap-1 overflow-x-auto rounded-lg border bg-[var(--surface)] p-1"
        role="tablist"
        aria-label="Operations views"
      >
        {tabs
          .filter((item) => item.id !== 'audit' || canManage)
          .map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              aria-selected={tab === item.id}
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-[color,background-color,transform] duration-200 active:scale-[0.97] motion-reduce:transform-none',
                tab === item.id
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'text-[var(--muted)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]',
              )}
              onClick={() => setTab(item.id)}
              role="tab"
              type="button"
            >
              {item.icon}
              {item.visibleLabel}
            </button>
          ))}
      </div>
      <section className="mt-4" aria-label={activeTitle}>
        {tab === 'orders' && (
          <Card>
            <div className="border-b px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">Đơn hàng</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Tìm kiếm và ngày áp dụng cho 10 bản ghi trên trang hiện tại.
                  </p>
                </div>
                <Filter
                  aria-hidden="true"
                  className="text-[var(--muted)]"
                  size={18}
                />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="text-sm font-medium">
                  Tìm đơn trên trang
                  <span className="relative mt-1 block">
                    <Search
                      aria-hidden="true"
                      className="absolute top-3 left-3 text-[var(--muted)]"
                      size={16}
                    />
                    <Input
                      aria-label="Tim don hang tren trang"
                      className="pl-9"
                      onChange={(event) => setOrderSearch(event.target.value)}
                      placeholder="Mã đơn hàng"
                      value={orderSearch}
                    />
                  </span>
                </label>
                <label className="text-sm font-medium">
                  Ngày đặt hàng
                  <Input
                    aria-label="Ngay dat hang tren trang"
                    className="mt-1"
                    onChange={(event) => setOrderDate(event.target.value)}
                    type="date"
                    value={orderDate}
                  />
                </label>
                <label className="text-sm font-medium">
                  Trạng thái
                  <Select
                    aria-label="Trang thai don hang"
                    className="mt-1"
                    onChange={(event) => setOrderStatus(event.target.value)}
                    value={orderStatus}
                  >
                    <option value="">Tất cả trạng thái</option>
                    {orderStatuses.map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>
            <QueueState
              empty={!visibleOrders.length}
              error={orders.error}
              loading={orders.loading}
            >
              <TableContainer className="rounded-none border-0">
                <Table className="min-w-[820px]">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Ngày đặt</th>
                      <th>Trạng thái</th>
                      <th>Tổng tiền</th>
                      <th>Lịch lắp đặt</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => (
                      <tr
                        className="motion-table-row hover:bg-[var(--surface-subtle)]"
                        key={order.id}
                      >
                        <td className="font-semibold text-[var(--primary)]">
                          <span className="inline-flex items-center gap-2">
                            <ClipboardList aria-hidden="true" size={15} />
                            {order.orderNumber}
                          </span>
                        </td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td>
                          <OperationsStatusBadge
                            kind="order"
                            status={order.status}
                          />
                        </td>
                        <td>{formatMoney(order.grandTotal)}</td>
                        <td>
                          {order.appointment ? (
                            <OperationsStatusBadge
                              kind="appointment"
                              status={order.appointment.status}
                            />
                          ) : (
                            <span className="text-[var(--muted)]">
                              Không có
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <Button
                            intent="secondary"
                            onClick={() => void openOrder(order.id)}
                            size="sm"
                            type="button"
                          >
                            Chi tiet
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </QueueState>
            <Pager
              disabledNext={!orders.data?.nextCursor || orders.loading}
              disabledPrevious={orders.index === 0 || orders.loading}
              next={orders.next}
              previous={orders.previous}
            />
          </Card>
        )}
        {tab === 'appointments' && (
          <Card>
            <div className="border-b px-4 py-4 sm:px-5">
              <div>
                <h2 className="font-semibold">Lịch lắp đặt</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Tìm đơn, khách hàng và khu vực trong trang hiện tại.
                </p>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <label className="text-sm font-medium">
                  Tìm lịch
                  <Input
                    aria-label="Tim lich lap dat tren trang"
                    className="mt-1"
                    onChange={(event) =>
                      setAppointmentSearch(event.target.value)
                    }
                    placeholder="Mã đơn hoặc tên khách hàng"
                    value={appointmentSearch}
                  />
                </label>
                <label className="text-sm font-medium">
                  Khu vực
                  <Input
                    aria-label="Khu vuc tren trang"
                    className="mt-1"
                    onChange={(event) =>
                      setAppointmentRegion(event.target.value)
                    }
                    placeholder="Quận, tỉnh hoặc mã vùng"
                    value={appointmentRegion}
                  />
                </label>
                <label className="text-sm font-medium">
                  Trạng thái
                  <Select
                    aria-label="Trang thai"
                    className="mt-1"
                    onChange={(event) =>
                      setAppointmentStatus(event.target.value)
                    }
                    value={appointmentStatus}
                  >
                    <option value="">Tất cả trạng thái</option>
                    {appointmentStatuses.map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>
            <QueueState
              empty={!visibleAppointments.length}
              error={appointments.error}
              loading={appointments.loading}
            >
              <TableContainer className="rounded-none border-0">
                <Table className="min-w-[960px]">
                  <thead>
                    <tr>
                      <th>Đơn hàng</th>
                      <th>Thời gian</th>
                      <th>Khu vực</th>
                      <th>Trạng thái</th>
                      <th>Kỹ thuật viên</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAppointments.map((item) => (
                      <tr
                        className="motion-table-row hover:bg-[var(--surface-subtle)]"
                        key={item.id}
                      >
                        <td>
                          <span className="font-semibold text-[var(--primary)]">
                            {item.order.orderNumber}
                          </span>
                          <br />
                          <span className="text-xs text-[var(--muted)]">
                            {item.order.recipientName}
                          </span>
                        </td>
                        <td>{formatDate(item.scheduledStartAt)}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin aria-hidden="true" size={14} />
                            {item.serviceArea.districtName}
                          </span>
                          <br />
                          <span className="text-xs text-[var(--muted)]">
                            {item.serviceArea.provinceName}
                          </span>
                        </td>
                        <td>
                          <OperationsStatusBadge
                            kind="appointment"
                            status={item.status}
                          />
                        </td>
                        <td>
                          {item.assignments.at(0)?.technician.user.name ? (
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound aria-hidden="true" size={14} />
                              {item.assignments.at(0)?.technician.user.name}
                            </span>
                          ) : (
                            <span className="text-[var(--muted)]">
                              Chưa phân công
                            </span>
                          )}
                        </td>
                        <td className="space-x-2 text-right">
                          {canManage &&
                            item.status === 'ASSIGNMENT_PENDING' && (
                              <Button
                                onClick={() => void openAssignment(item)}
                                size="sm"
                                type="button"
                              >
                                <UserRoundCheck size={15} />
                                Phan cong
                              </Button>
                            )}
                          {canManage &&
                            [
                              'SCHEDULED',
                              'ASSIGNMENT_PENDING',
                              'ASSIGNED',
                              'RESCHEDULE_REQUIRED',
                            ].includes(item.status) && (
                              <Button
                                intent="secondary"
                                onClick={() => openReschedule(item)}
                                size="sm"
                                type="button"
                              >
                                <CalendarClock size={15} />
                                Doi lich
                              </Button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </QueueState>
            <Pager
              disabledNext={
                !appointments.data?.nextCursor || appointments.loading
              }
              disabledPrevious={
                appointments.index === 0 || appointments.loading
              }
              next={appointments.next}
              previous={appointments.previous}
            />
          </Card>
        )}
        {tab === 'warranties' && (
          <Card>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">Yêu cầu bảo hành</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Hàng đợi được phân trang từ server.
                </p>
              </div>
              <label className="ml-auto w-full text-sm font-medium sm:w-64">
                Trạng thái
                <Select
                  aria-label="Trang thai bao hanh"
                  className="mt-1"
                  onChange={(event) => setWarrantyStatus(event.target.value)}
                  value={warrantyStatus}
                >
                  <option value="">Tất cả trạng thái</option>
                  {warrantyStatuses.map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <QueueState
              empty={!warranties.data?.items.length}
              error={warranties.error}
              loading={warranties.loading}
            >
              <TableContainer className="rounded-none border-0">
                <Table className="min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Mã yêu cầu</th>
                      <th>Ngày gửi</th>
                      <th>Đơn hàng</th>
                      <th>Loại lỗi</th>
                      <th>Trạng thái</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warranties.data?.items.map((item) => (
                      <tr
                        className="motion-table-row hover:bg-[var(--surface-subtle)]"
                        key={item.id}
                      >
                        <td className="font-semibold">{item.requestNumber}</td>
                        <td>{formatDate(item.createdAt)}</td>
                        <td>{item.orderItem.order.orderNumber}</td>
                        <td>{item.issueType}</td>
                        <td>
                          <OperationsStatusBadge
                            kind="warranty"
                            status={item.status}
                          />
                        </td>
                        <td className="text-right">
                          <Button
                            intent="secondary"
                            onClick={() =>
                              void request<WarrantyDetail>(
                                `/api/v1/admin/operations/warranties/${item.id}`,
                              ).then(setWarrantyDetail)
                            }
                            size="sm"
                            type="button"
                          >
                            Chi tiet
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </QueueState>
            <Pager
              disabledNext={!warranties.data?.nextCursor || warranties.loading}
              disabledPrevious={warranties.index === 0 || warranties.loading}
              next={warranties.next}
              previous={warranties.previous}
            />
          </Card>
        )}
        {tab === 'audit' && (
          <Card>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">Nhật ký audit</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Dữ liệu nhạy cảm không được hiển thị trong bảng.
                </p>
              </div>
              <label className="ml-auto w-full text-sm font-medium sm:w-72">
                Action
                <Input
                  aria-label="Loc audit theo action"
                  className="mt-1"
                  onChange={(event) => setAuditAction(event.target.value)}
                  placeholder="Ví dụ: operations.appointment..."
                  value={auditAction}
                />
              </label>
            </div>
            <QueueState
              empty={!audit.data?.items.length}
              error={audit.error}
              loading={audit.loading}
            >
              <TableContainer className="rounded-none border-0">
                <Table className="min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data?.items.map((item) => (
                      <tr
                        className="motion-table-row hover:bg-[var(--surface-subtle)]"
                        key={item.id}
                      >
                        <td>{formatDate(item.createdAt)}</td>
                        <td>
                          <strong className="block font-medium">
                            {item.actor.name}
                          </strong>
                          <span className="text-xs text-[var(--muted)]">
                            {item.actor.email}
                          </span>
                        </td>
                        <td>{item.action}</td>
                        <td>
                          {item.targetType} / {item.targetId}
                        </td>
                        <td>{item.reason ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </QueueState>
            <Pager
              disabledNext={!audit.data?.nextCursor || audit.loading}
              disabledPrevious={audit.index === 0 || audit.loading}
              next={audit.next}
              previous={audit.previous}
            />
          </Card>
        )}
      </section>
      {orderDetail || detailLoading || detailError ? (
        <Dialog
          onClose={() => {
            setOrderDetail(null);
            setDetailError(null);
          }}
          title="Chi tiet don hang"
        >
          {detailLoading && <Loading label="Đang tải chi tiết đơn hàng..." />}
          {detailError && <Alert variant="error">{detailError}</Alert>}
          {orderDetail && (
            <div className="space-y-6">
              <div className="grid gap-4 rounded-lg bg-[var(--surface-subtle)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p className="min-w-0">
                  <span className="text-[var(--muted)]">Mã đơn</span>
                  <br />
                  <strong>{orderDetail.orderNumber}</strong>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Trạng thái</span>
                  <br />
                  <OperationsStatusBadge
                    kind="order"
                    status={orderDetail.status}
                  />
                </p>
                <p>
                  <span className="text-[var(--muted)]">Thanh toán</span>
                  <br />
                  <strong>{orderDetail.payment?.method ?? 'Chưa có'}</strong>
                  {orderDetail.payment
                    ? ` / ${orderDetail.payment.status}`
                    : ''}
                </p>
                <p>
                  <span className="text-[var(--muted)]">Tổng tiền</span>
                  <br />
                  <strong>{formatMoney(orderDetail.grandTotal)}</strong>
                </p>
              </div>
              <section className="grid gap-4 border-b pb-5 text-sm md:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <UserRound aria-hidden="true" size={17} /> Khách hàng
                  </h3>
                  <p className="mt-2">{orderDetail.recipientName}</p>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <MapPin aria-hidden="true" size={17} /> Địa chỉ lắp đặt
                  </h3>
                  <p className="mt-2 text-[var(--muted)]">
                    {orderDetail.addressLine1}, {orderDetail.wardName},{' '}
                    {orderDetail.districtName}, {orderDetail.provinceName}
                  </p>
                </div>
              </section>
              <section>
                <h3 className="flex items-center gap-2 font-semibold">
                  <PackageCheck aria-hidden="true" size={17} /> Hạng mục đơn
                  hàng
                </h3>
                <ul className="mt-3 divide-y rounded-lg border">
                  {orderDetail.items.map((item) => (
                    <li
                      className="flex justify-between px-3 py-2 text-sm"
                      key={item.id}
                    >
                      <span>
                        {item.productName} / {item.variantName} x{' '}
                        {item.quantity}
                      </span>
                      <span>{formatMoney(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {orderDetail.appointment && (
                <section className="rounded-lg border p-4">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <CalendarClock aria-hidden="true" size={17} /> Lắp đặt
                  </h3>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <p>
                      <span className="block text-xs text-[var(--muted)]">
                        Trạng thái
                      </span>
                      <OperationsStatusBadge
                        kind="appointment"
                        status={orderDetail.appointment.status}
                      />
                    </p>
                    <p>
                      <span className="block text-xs text-[var(--muted)]">
                        Thời gian
                      </span>
                      {formatDate(orderDetail.appointment.scheduledStartAt)}
                    </p>
                    <p>
                      <span className="block text-xs text-[var(--muted)]">
                        Kỹ thuật viên
                      </span>
                      {orderDetail.appointment.assignments.at(0)?.technician
                        .user.name ?? 'Chưa phân công'}
                    </p>
                  </div>
                </section>
              )}
              {canManage && (
                <section>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <ShieldCheck aria-hidden="true" size={17} /> Lịch sử audit
                  </h3>
                  {orderAudit.length ? (
                    <ul className="mt-3 divide-y rounded-lg border text-sm">
                      {orderAudit.map((event) => (
                        <li className="px-3 py-2" key={event.id}>
                          <strong>{event.action}</strong> - {event.actor.name}{' '}
                          <span className="text-[var(--muted)]">
                            {formatDate(event.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Chưa có sự kiện audit hiển thị cho đơn hàng này.
                    </p>
                  )}
                </section>
              )}
              <section>
                <h3 className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 aria-hidden="true" size={17} /> Chuyển trạng
                  thái
                </h3>
                {orderActions.length ? (
                  <div className="mt-2 space-y-3">
                    <label className="block text-sm font-medium">
                      Lý do thay đổi
                      <Textarea
                        className="mt-1"
                        maxLength={300}
                        onChange={(event) =>
                          setActionReason(event.target.value)
                        }
                        value={actionReason}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {orderActions.map((item) => (
                        <Button
                          disabled={actionReason.trim().length < 3}
                          key={item.action}
                          onClick={() =>
                            setConfirm({
                              title: item.label,
                              description: `Xac nhan action cho don ${orderDetail.orderNumber}.`,
                              execute: async () => {
                                try {
                                  await request(
                                    `/api/v1/admin/orders/${orderDetail.id}/actions`,
                                    {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        action: item.action,
                                        expectedVersion: orderDetail.version,
                                        reason: actionReason,
                                      }),
                                    },
                                  );
                                  await openOrder(orderDetail.id);
                                  refreshOperations();
                                  setActionReason('');
                                } catch (error: unknown) {
                                  setDetailError(
                                    error instanceof Error
                                      ? error.message
                                      : 'Cap nhat trang thai that bai.',
                                  );
                                  refreshOperations();
                                }
                              },
                            })
                          }
                          size="sm"
                          type="button"
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Không có action hợp lệ theo trạng thái và quyền hiện tại.
                  </p>
                )}
              </section>
            </div>
          )}
        </Dialog>
      ) : null}
      {assignment && (
        <Dialog
          onClose={() => setAssignment(null)}
          title="Phan cong ky thuat vien"
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              {assignment.order.orderNumber} -{' '}
              {formatDate(assignment.scheduledStartAt)}
            </p>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                setTechnicianId('');
                void loadTechnicians(assignment, undefined, technicianSearch);
              }}
            >
              <label className="min-w-0 flex-1 text-sm font-medium">
                Tìm kỹ thuật viên
                <Input
                  className="mt-1"
                  onChange={(event) => setTechnicianSearch(event.target.value)}
                  placeholder="Tên kỹ thuật viên"
                  value={technicianSearch}
                />
              </label>
              <Button
                className="mt-6"
                disabled={assignmentLoading}
                intent="secondary"
                size="icon"
                title="Tìm kỹ thuật viên"
                type="submit"
              >
                <Search aria-hidden="true" size={17} />
              </Button>
            </form>
            {assignmentLoading && (
              <Loading label="Đang tìm kỹ thuật viên phù hợp..." />
            )}
            {assignmentError && (
              <Alert variant="error">{assignmentError}</Alert>
            )}
            {!assignmentLoading && !assignmentError && !technicians.length && (
              <EmptyState
                description="Không có kỹ thuật viên active cùng khu vực và không trùng lịch."
                icon={<UserRound aria-hidden="true" size={22} />}
                title="Không tìm thấy kỹ thuật viên phù hợp"
              />
            )}
            {technicians.map((item) => (
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors',
                  technicianId === item.id &&
                    'border-[var(--primary)] bg-[var(--primary-soft)]',
                )}
                key={item.id}
              >
                <input
                  checked={technicianId === item.id}
                  name="technician"
                  onChange={() => setTechnicianId(item.id)}
                  type="radio"
                  value={item.id}
                />
                {item.user.name}
              </label>
            ))}
            {technicianNextCursor && (
              <Button
                disabled={assignmentLoading}
                intent="secondary"
                onClick={() =>
                  assignment &&
                  void loadTechnicians(assignment, technicianNextCursor)
                }
                type="button"
              >
                Tai them ky thuat vien
              </Button>
            )}
            <label className="block text-sm font-medium">
              Ly do phan cong
              <Textarea
                className="mt-1"
                maxLength={300}
                onChange={(event) => setAssignmentReason(event.target.value)}
                value={assignmentReason}
              />
            </label>
            <Button
              disabled={
                assignmentLoading ||
                !technicianId ||
                assignmentReason.trim().length < 3
              }
              onClick={() =>
                setConfirm({
                  title: 'Xac nhan phan cong',
                  description:
                    'Lich cua ky thuat vien se duoc kiem tra lai tren server.',
                  execute: async () => {
                    setAssignmentLoading(true);
                    setAssignmentError(null);
                    try {
                      await request(
                        `/api/v1/admin/operations/appointments/${assignment.id}/assign`,
                        {
                          method: 'POST',
                          body: JSON.stringify({
                            technicianId,
                            expectedVersion: assignment.version,
                            reason: assignmentReason,
                          }),
                        },
                      );
                      setAssignment(null);
                      refreshOperations();
                    } catch (error: unknown) {
                      setAssignmentError(
                        error instanceof Error
                          ? error.message
                          : 'Phan cong that bai.',
                      );
                    } finally {
                      setAssignmentLoading(false);
                    }
                  },
                })
              }
              loading={assignmentLoading}
              type="button"
            >
              Phan cong
            </Button>
          </div>
        </Dialog>
      )}
      {reschedule && (
        <Dialog onClose={() => setReschedule(null)} title="Doi lich lap dat">
          <div className="space-y-4">
            <label className="block text-sm font-medium">
              Ngay moi
              <Input
                className="mt-1"
                min={currentDate(new Date().toISOString())}
                onChange={(event) => {
                  const date = event.target.value;
                  setRescheduleDate(date);
                  if (date >= currentDate(new Date().toISOString()))
                    void loadSlots(reschedule, date);
                  else setRescheduleError('Khong the chon ngay trong qua khu.');
                }}
                type="date"
                value={rescheduleDate}
              />
            </label>
            {rescheduleLoading && <Loading label="Đang tải khung giờ..." />}
            {slots.map((slot) => (
              <label
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-md border p-3 text-sm',
                  slotId === slot.id &&
                    'border-[var(--primary)] bg-[var(--primary-soft)]',
                )}
                key={slot.id}
              >
                <span>
                  <input
                    checked={slotId === slot.id}
                    className="mr-3"
                    disabled={slot.available <= 0}
                    name="slot"
                    onChange={() => setSlotId(slot.id)}
                    type="radio"
                  />
                  {formatDate(slot.startsAt)}
                </span>
                <span className="text-[var(--muted)]">
                  Con {slot.available}
                </span>
              </label>
            ))}
            {!rescheduleLoading && !slots.length && !rescheduleError && (
              <p className="text-sm text-[var(--muted)]">
                Khong co khung gio phu hop trong ngay nay.
              </p>
            )}
            <label className="block text-sm font-medium">
              Ly do doi lich
              <Textarea
                className="mt-1"
                maxLength={300}
                onChange={(event) => setRescheduleReason(event.target.value)}
                value={rescheduleReason}
              />
            </label>
            <p className="min-h-5 text-sm text-[#8b1e1e]" role="alert">
              {rescheduleError}
            </p>
            <Button
              disabled={
                rescheduleLoading ||
                !slotId ||
                rescheduleReason.trim().length < 3
              }
              loading={rescheduleLoading}
              onClick={() =>
                setConfirm({
                  title: 'Xac nhan doi lich',
                  description:
                    'Server se kiem tra lai suc chua cua slot truoc khi luu.',
                  execute: async () => {
                    setRescheduleLoading(true);
                    setRescheduleError(null);
                    try {
                      await request(
                        `/api/v1/admin/operations/appointments/${reschedule.id}/reschedule`,
                        {
                          method: 'POST',
                          body: JSON.stringify({
                            slotId,
                            expectedVersion: reschedule.version,
                            reason: rescheduleReason,
                          }),
                        },
                      );
                      setReschedule(null);
                      refreshOperations();
                    } catch (error: unknown) {
                      setRescheduleError(
                        error instanceof Error
                          ? error.message
                          : 'Doi lich that bai.',
                      );
                    } finally {
                      setRescheduleLoading(false);
                    }
                  },
                })
              }
              type="button"
            >
              Doi lich
            </Button>
          </div>
        </Dialog>
      )}
      {warrantyDetail && (
        <Dialog
          onClose={() => setWarrantyDetail(null)}
          title="Chi tiet bao hanh"
        >
          <div className="space-y-4 text-sm">
            <p>
              <span className="text-[var(--muted)]">Ma yeu cau</span>
              <br />
              <strong>{warrantyDetail.requestNumber}</strong>
            </p>
            <p>
              <span className="text-[var(--muted)]">Khach hang</span>
              <br />
              {warrantyDetail.customer.name}
            </p>
            <p>
              <span className="text-[var(--muted)]">San pham</span>
              <br />
              {warrantyDetail.orderItem.productName} /{' '}
              {warrantyDetail.orderItem.variantName}
            </p>
            <p>
              <span className="text-[var(--muted)]">Don va lap dat</span>
              <br />
              {warrantyDetail.orderItem.order.orderNumber} -{' '}
              {warrantyDetail.orderItem.order.appointment?.status ??
                'Chua co lich'}
            </p>
            <p>
              <span className="text-[var(--muted)]">Mo ta</span>
              <br />
              {warrantyDetail.description}
            </p>
            <p className="border-t pt-4 text-[var(--muted)]">
              Chua co action bao hanh trong server policy hien tai.
            </p>
          </div>
        </Dialog>
      )}
      {confirm && (
        <Dialog onClose={() => setConfirm(null)} title={confirm.title}>
          <p className="text-sm text-[var(--muted)]">{confirm.description}</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              className="bg-[#41556f] hover:bg-[#304155]"
              onClick={() => setConfirm(null)}
              type="button"
            >
              Huy
            </Button>
            <Button
              onClick={() => {
                const execute = confirm.execute;
                setConfirm(null);
                void execute();
              }}
              type="button"
            >
              Xac nhan
            </Button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
