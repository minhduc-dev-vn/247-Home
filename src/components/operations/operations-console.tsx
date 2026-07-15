'use client';

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileSearch,
  ShieldCheck,
  UserRoundCheck,
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

const orderStatuses = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_INSTALLATION',
  'INSTALLATION_IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];
const appointmentStatuses = [
  'ASSIGNMENT_PENDING',
  'ASSIGNED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'RESCHEDULE_REQUIRED',
  'CANCELLED',
];
const warrantyStatuses = ['SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'CLOSED'];

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
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-white shadow-xl"
        role="dialog"
      >
        <header className="flex items-center gap-3 border-b px-5 py-4">
          <h2 className="text-lg font-semibold" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="Dong"
            className="ml-auto grid h-9 w-9 place-items-center rounded-md hover:bg-[#edf1f5]"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
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
        onClick={previous}
        size="sm"
        type="button"
      >
        <ArrowLeft size={16} />
      </Button>
      <Button
        aria-label="Trang sau"
        disabled={disabledNext}
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
    return (
      <p className="px-4 py-8 text-sm text-[var(--muted)]">
        Dang tai du lieu...
      </p>
    );
  if (error)
    return (
      <p className="m-4 flex items-center gap-2 border border-[#dc5656] bg-[#fff4f4] px-3 py-3 text-sm text-[#8b1e1e]">
        <AlertCircle size={16} />
        {error}
      </p>
    );
  if (empty)
    return (
      <p className="px-4 py-8 text-sm text-[var(--muted)]">
        Khong co du lieu phu hop.
      </p>
    );
  return <>{children}</>;
}

export function OperationsConsole({ roles }: { roles: Roles }) {
  const [tab, setTab] = useState<Tab>('orders');
  const [orderStatus, setOrderStatus] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('');
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
    async (appointment: AppointmentRow, cursor?: string) => {
      setAssignmentLoading(true);
      setAssignmentError(null);
      try {
        const params = new URLSearchParams({
          appointmentId: appointment.id,
          limit: '25',
        });
        if (cursor) params.set('cursor', cursor);
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
    [],
  );

  const openAssignment = useCallback(
    async (appointment: AppointmentRow) => {
      setAssignment(appointment);
      setTechnicians([]);
      setTechnicianNextCursor(null);
      setTechnicianId('');
      setAssignmentReason('');
      await loadTechnicians(appointment);
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
        orders: 'Don hang',
        appointments: 'Lich lap dat',
        warranties: 'Bao hanh',
        audit: 'Nhat ky audit',
      })[tab],
    [tab],
  );
  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: 'orders', label: 'Don hang', icon: <ClipboardList size={16} /> },
    { id: 'appointments', label: 'Lap dat', icon: <CalendarClock size={16} /> },
    { id: 'warranties', label: 'Bao hanh', icon: <FileSearch size={16} /> },
    { id: 'audit', label: 'Audit', icon: <ShieldCheck size={16} /> },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-8">
      <header className="border-b pb-6">
        <p className="text-sm font-medium text-[var(--primary)]">
          247 Home / Quan tri
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Operations</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Theo doi don hang, lich lap dat, bao hanh va nhat ky van hanh.
        </p>
      </header>
      <div
        className="mt-6 flex flex-wrap gap-2 border-b"
        role="tablist"
        aria-label="Operations views"
      >
        {tabs
          .filter((item) => item.id !== 'audit' || canManage)
          .map((item) => (
            <button
              key={item.id}
              aria-selected={tab === item.id}
              className={cn(
                'inline-flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium',
                tab === item.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
              onClick={() => setTab(item.id)}
              role="tab"
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
      </div>
      <section className="mt-5 border bg-white" aria-label={activeTitle}>
        {tab === 'orders' && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <h2 className="font-semibold">Don hang</h2>
              <label className="ml-auto flex items-center gap-2 text-sm">
                Trang thai
                <select
                  className="h-9 rounded-md border bg-white px-2"
                  onChange={(event) => setOrderStatus(event.target.value)}
                  value={orderStatus}
                >
                  <option value="">Tat ca</option>
                  {orderStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <QueueState
              empty={!orders.data?.items.length}
              error={orders.error}
              loading={orders.loading}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#f7f8fa] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3">Ma don</th>
                      <th>Trang thai</th>
                      <th>Tong tien</th>
                      <th>Lich lap dat</th>
                      <th className="px-4 py-3 text-right">Thao tac</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data?.items.map((order) => (
                      <tr className="border-t" key={order.id}>
                        <td className="px-4 py-3 font-medium">
                          {order.orderNumber}
                        </td>
                        <td>{order.status}</td>
                        <td>{formatMoney(order.grandTotal)}</td>
                        <td>{order.appointment?.status ?? 'Khong co'}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
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
                </table>
              </div>
            </QueueState>
            <Pager
              disabledNext={!orders.data?.nextCursor || orders.loading}
              disabledPrevious={orders.index === 0 || orders.loading}
              next={orders.next}
              previous={orders.previous}
            />
          </>
        )}
        {tab === 'appointments' && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <h2 className="font-semibold">Lich lap dat</h2>
              <label className="ml-auto flex items-center gap-2 text-sm">
                Trang thai
                <select
                  className="h-9 rounded-md border bg-white px-2"
                  onChange={(event) => setAppointmentStatus(event.target.value)}
                  value={appointmentStatus}
                >
                  <option value="">Tat ca</option>
                  {appointmentStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <QueueState
              empty={!appointments.data?.items.length}
              error={appointments.error}
              loading={appointments.loading}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-[#f7f8fa] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3">Don hang</th>
                      <th>Thoi gian</th>
                      <th>Trang thai</th>
                      <th>Ky thuat vien</th>
                      <th className="px-4 py-3 text-right">Thao tac</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.data?.items.map((item) => (
                      <tr className="border-t" key={item.id}>
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {item.order.orderNumber}
                          </span>
                          <br />
                          <span className="text-xs text-[var(--muted)]">
                            {item.serviceArea.districtName}
                          </span>
                        </td>
                        <td>{formatDate(item.scheduledStartAt)}</td>
                        <td>{item.status}</td>
                        <td>
                          {item.assignments.at(0)?.technician.user.name ??
                            'Chua phan cong'}
                        </td>
                        <td className="space-x-2 px-4 py-3 text-right">
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
                                className="bg-[#41556f] hover:bg-[#304155]"
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
                </table>
              </div>
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
          </>
        )}
        {tab === 'warranties' && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <h2 className="font-semibold">Yeu cau bao hanh</h2>
              <label className="ml-auto flex items-center gap-2 text-sm">
                Trang thai
                <select
                  className="h-9 rounded-md border bg-white px-2"
                  onChange={(event) => setWarrantyStatus(event.target.value)}
                  value={warrantyStatus}
                >
                  <option value="">Tat ca</option>
                  {warrantyStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <QueueState
              empty={!warranties.data?.items.length}
              error={warranties.error}
              loading={warranties.loading}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#f7f8fa] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3">Ma yeu cau</th>
                      <th>Don hang</th>
                      <th>Loai loi</th>
                      <th>Trang thai</th>
                      <th className="px-4 py-3 text-right">Thao tac</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warranties.data?.items.map((item) => (
                      <tr className="border-t" key={item.id}>
                        <td className="px-4 py-3 font-medium">
                          {item.requestNumber}
                        </td>
                        <td>{item.orderItem.order.orderNumber}</td>
                        <td>{item.issueType}</td>
                        <td>{item.status}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
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
                </table>
              </div>
            </QueueState>
            <Pager
              disabledNext={!warranties.data?.nextCursor || warranties.loading}
              disabledPrevious={warranties.index === 0 || warranties.loading}
              next={warranties.next}
              previous={warranties.previous}
            />
          </>
        )}
        {tab === 'audit' && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <h2 className="font-semibold">Nhat ky audit</h2>
              <label className="ml-auto flex items-center gap-2 text-sm">
                Action
                <input
                  className="h-9 w-48 rounded-md border px-2"
                  onChange={(event) => setAuditAction(event.target.value)}
                  placeholder="Vi du: operations..."
                  value={auditAction}
                />
              </label>
            </div>
            <QueueState
              empty={!audit.data?.items.length}
              error={audit.error}
              loading={audit.loading}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#f7f8fa] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3">Thoi gian</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th className="px-4 py-3">Ly do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data?.items.map((item) => (
                      <tr className="border-t" key={item.id}>
                        <td className="px-4 py-3">
                          {formatDate(item.createdAt)}
                        </td>
                        <td>{item.actor.name}</td>
                        <td>{item.action}</td>
                        <td>
                          {item.targetType} / {item.targetId}
                        </td>
                        <td className="px-4 py-3">{item.reason ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueueState>
            <Pager
              disabledNext={!audit.data?.nextCursor || audit.loading}
              disabledPrevious={audit.index === 0 || audit.loading}
              next={audit.next}
              previous={audit.previous}
            />
          </>
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
          {detailLoading && (
            <p className="text-sm text-[var(--muted)]">Dang tai...</p>
          )}
          {detailError && (
            <p className="text-sm text-[#8b1e1e]">{detailError}</p>
          )}
          {orderDetail && (
            <div className="space-y-6">
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-[var(--muted)]">Ma don</span>
                  <br />
                  <strong>{orderDetail.orderNumber}</strong>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Trang thai</span>
                  <br />
                  <strong>{orderDetail.status}</strong>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Khach hang</span>
                  <br />
                  {orderDetail.recipientName}
                </p>
                <p>
                  <span className="text-[var(--muted)]">Dia chi</span>
                  <br />
                  {orderDetail.addressLine1}, {orderDetail.wardName},{' '}
                  {orderDetail.districtName}
                </p>
              </div>
              <section>
                <h3 className="font-semibold">Hang muc</h3>
                <ul className="mt-2 divide-y border">
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
                <section>
                  <h3 className="font-semibold">Lap dat</h3>
                  <p className="mt-2 text-sm">
                    {orderDetail.appointment.status} -{' '}
                    {formatDate(orderDetail.appointment.scheduledStartAt)}
                  </p>
                  <p className="mt-1 text-sm">
                    Ky thuat vien:{' '}
                    {orderDetail.appointment.assignments.at(0)?.technician.user
                      .name ?? 'Chua phan cong'}
                  </p>
                </section>
              )}
              {canManage && (
                <section>
                  <h3 className="font-semibold">Lich su audit</h3>
                  {orderAudit.length ? (
                    <ul className="mt-2 divide-y border text-sm">
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
                      Chua co su kien audit hien thi cho don hang nay.
                    </p>
                  )}
                </section>
              )}
              <section>
                <h3 className="font-semibold">Chuyen trang thai</h3>
                {orderActions.length ? (
                  <div className="mt-2 space-y-3">
                    <label className="block text-sm">
                      Ly do
                      <textarea
                        className="mt-1 block w-full rounded-md border p-2"
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
                    Khong co action hop le theo state va quyen hien tai.
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
            {assignmentLoading && (
              <p className="text-sm">Dang tim ky thuat vien phu hop...</p>
            )}
            {assignmentError && (
              <p className="text-sm text-[#8b1e1e]" role="alert">
                {assignmentError}
              </p>
            )}
            {!assignmentLoading && !assignmentError && !technicians.length && (
              <p className="text-sm text-[var(--muted)]">
                Khong co ky thuat vien phu hop ve khu vuc va lich lam viec.
              </p>
            )}
            {technicians.map((item) => (
              <label
                className="flex cursor-pointer items-center gap-3 border p-3 text-sm"
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
                onClick={() =>
                  assignment &&
                  void loadTechnicians(assignment, technicianNextCursor)
                }
                type="button"
              >
                Tai them ky thuat vien
              </Button>
            )}
            <label className="block text-sm">
              Ly do phan cong
              <textarea
                className="mt-1 block w-full rounded-md border p-2"
                maxLength={300}
                onChange={(event) => setAssignmentReason(event.target.value)}
                value={assignmentReason}
              />
            </label>
            <p className="min-h-5 text-sm text-[#8b1e1e]" role="alert">
              {assignmentError}
            </p>
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
              type="button"
            >
              {assignmentLoading ? 'Dang xu ly...' : 'Phan cong'}
            </Button>
          </div>
        </Dialog>
      )}
      {reschedule && (
        <Dialog onClose={() => setReschedule(null)} title="Doi lich lap dat">
          <div className="space-y-4">
            <label className="block text-sm">
              Ngay moi
              <input
                className="mt-1 block h-10 w-full rounded-md border px-2"
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
            {rescheduleLoading && (
              <p className="text-sm">Dang tai khung gio...</p>
            )}
            {slots.map((slot) => (
              <label
                className="flex cursor-pointer items-center justify-between border p-3 text-sm"
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
            <label className="block text-sm">
              Ly do doi lich
              <textarea
                className="mt-1 block w-full rounded-md border p-2"
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
              {rescheduleLoading ? 'Dang xu ly...' : 'Doi lich'}
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
