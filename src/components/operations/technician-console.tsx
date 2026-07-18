'use client';

import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  ClipboardCheck,
  Clock3,
  ImageIcon,
  MapPin,
  Navigation,
  PackageCheck,
  Play,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { OperationsStatusBadge } from '@/components/operations/operations-presentation';
import { buildTechnicianTimeline } from '@/components/operations/technician-presentation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatServiceDateTime } from '@/shared/date/service-time';

type Page<T> = { items: T[]; nextCursor: string | null };
type JobRow = {
  id: string;
  status: 'ACTIVE' | 'COMPLETED';
  appointment: {
    id: string;
    status: string;
    version: number;
    scheduledStartAt: string;
    scheduledEndAt: string;
    serviceArea: { code: string; provinceName: string; districtName: string };
    order: { orderNumber: string };
  };
};
type Evidence = {
  id: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};
type JobDetail = {
  id: string;
  status: 'ACTIVE' | 'COMPLETED';
  completionNote: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  enRouteAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  appointment: {
    id: string;
    status: string;
    version: number;
    scheduledStartAt: string;
    scheduledEndAt: string;
    customerNote: string | null;
    serviceArea: { code: string; provinceName: string; districtName: string };
    order: {
      orderNumber: string;
      recipientName: string;
      addressLine1: string;
      wardName: string;
      districtName: string;
      provinceName: string;
      items: Array<{
        id: string;
        productName: string;
        variantName: string;
        servicePackageName: string | null;
        quantity: number;
      }>;
    };
  };
  evidence: Evidence[];
};
type ActionName = 'accept' | 'en-route' | 'arrive' | 'start' | 'complete';
type ActionOption = {
  action: ActionName;
  label: string;
  requiresNote: boolean;
};
type ApiError = { error?: { message?: string } };

const appointmentStatuses = [
  'ASSIGNED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
] as const;
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const maxEvidenceBytes = 5 * 1024 * 1024;

const actionPresentation: Record<
  ActionName,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  accept: { label: 'Nhận việc', icon: ClipboardCheck },
  'en-route': { label: 'Bắt đầu di chuyển', icon: Navigation },
  arrive: { label: 'Đã đến', icon: MapPin },
  start: { label: 'Bắt đầu công việc', icon: Play },
  complete: { label: 'Hoàn thành', icon: CheckCircle2 },
};

function formatDate(value: string) {
  return formatServiceDateTime(value);
}

function errorMessage(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    body.error &&
    typeof body.error === 'object' &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  )
    return body.error.message;
  return fallback;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json()) as { data?: T } & ApiError;
  if (!response.ok || !body.data)
    throw new Error(errorMessage(body, 'Không thể xử lý yêu cầu.'));
  return body.data;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Không thể đọc tệp ảnh.'));
        return;
      }
      resolve(reader.result.split(',', 2)[1] ?? '');
    };
    reader.readAsDataURL(file);
  });
}

function ConfirmDialog({
  action,
  loading,
  onClose,
  onConfirm,
}: {
  action: ActionOption;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const presentation = actionPresentation[action.action];
  const Icon = presentation.icon;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-lg border bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)]"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold" id={titleId}>
              Xác nhận {presentation.label.toLocaleLowerCase('vi')}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Trạng thái hiện tại sẽ được kiểm tra lại trên server trước khi
              lưu.
            </p>
          </div>
          <button
            aria-label="Đóng xác nhận"
            className="ml-auto grid size-9 place-items-center rounded-md hover:bg-[var(--secondary)]"
            disabled={loading}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="mt-5 flex gap-2">
          <Button
            className="min-h-11 flex-1"
            disabled={loading}
            intent="secondary"
            onClick={onClose}
            type="button"
          >
            Quay lại
          </Button>
          <Button
            className="min-h-11 flex-1"
            loading={loading}
            onClick={onConfirm}
            type="button"
          >
            Xác nhận
          </Button>
        </div>
      </section>
    </div>
  );
}

function PageHeader({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <Breadcrumb
          items={[
            { href: '/technician/orders', label: 'Kỹ thuật viên' },
            { label: title },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          {description}
        </p>
      </div>
      {children}
    </header>
  );
}

export function TechnicianOrdersList() {
  const [status, setStatus] = useState('');
  const [jobs, setJobs] = useState<Page<JobRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursors, setCursors] = useState(['']);
  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorIndexRef = useRef(0);
  const requestSequence = useRef(0);

  const loadJobs = useCallback(
    async (cursor = '', direction: 'reset' | 'next' | 'previous' = 'reset') => {
      const sequence = ++requestSequence.current;
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: '10' });
      if (status) params.set('status', status);
      if (cursor) params.set('cursor', cursor);
      try {
        const page = await request<Page<JobRow>>(
          `/api/v1/technician/assignments?${params.toString()}`,
        );
        if (sequence !== requestSequence.current) return;
        setJobs(page);
        if (direction === 'next') {
          setCursors((previous) => [
            ...previous.slice(0, cursorIndexRef.current + 1),
            cursor,
          ]);
          cursorIndexRef.current += 1;
          setCursorIndex(cursorIndexRef.current);
        } else if (direction === 'previous') {
          cursorIndexRef.current = Math.max(0, cursorIndexRef.current - 1);
          setCursorIndex(cursorIndexRef.current);
        } else {
          setCursors(['']);
          cursorIndexRef.current = 0;
          setCursorIndex(0);
        }
      } catch (requestError: unknown) {
        if (sequence === requestSequence.current)
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Không thể tải công việc.',
          );
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    queueMicrotask(() => void loadJobs());
  }, [loadJobs]);

  const next = () => {
    if (jobs?.nextCursor) void loadJobs(jobs.nextCursor, 'next');
  };
  const previous = () => {
    if (cursorIndex > 0) void loadJobs(cursors[cursorIndex - 1], 'previous');
  };

  return (
    <main className="mx-auto min-h-0 max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        description="Xem lịch lắp đặt được phân công và mở từng công việc để cập nhật tiến độ."
        title="Công việc của tôi"
      >
        <Button
          aria-label="Tải lại danh sách công việc"
          intent="secondary"
          onClick={() => void loadJobs()}
          size="icon"
          title="Tải lại"
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} />
        </Button>
      </PageHeader>

      <Card className="mt-6">
        <div className="flex flex-wrap items-end gap-3 border-b px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-semibold">Lịch lắp đặt</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Chỉ hiển thị assignment thuộc tài khoản đang đăng nhập.
            </p>
          </div>
          <label className="ml-auto w-full text-sm font-medium sm:w-60">
            Trạng thái
            <Select
              aria-label="Trang thai"
              className="mt-1"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">Tất cả trạng thái</option>
              {appointmentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {loading ? (
          <Loading className="min-h-64" label="Đang tải công việc..." />
        ) : error ? (
          <Alert
            className="m-4"
            title="Không thể tải công việc"
            variant="error"
          >
            {error}
          </Alert>
        ) : !jobs?.items.length ? (
          <EmptyState
            description="Thử chọn trạng thái khác hoặc kiểm tra lại sau."
            title="Không có công việc phù hợp"
          />
        ) : (
          <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2">
            {jobs.items.map((job) => (
              <article
                className="flex min-w-0 flex-col rounded-lg border bg-[var(--surface)] p-4"
                data-testid="technician-job-card"
                key={job.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--muted)]">
                      ĐƠN HÀNG
                    </p>
                    <h3 className="mt-1 truncate font-semibold text-[var(--primary)]">
                      {job.appointment.order.orderNumber}
                    </h3>
                  </div>
                  <OperationsStatusBadge
                    kind="appointment"
                    status={job.appointment.status}
                  />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <CalendarClock
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[var(--primary)]"
                      size={16}
                    />
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Khung giờ</dt>
                      <dd>{formatDate(job.appointment.scheduledStartAt)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[var(--primary)]"
                      size={16}
                    />
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Khu vực</dt>
                      <dd>{job.appointment.serviceArea.districtName}</dd>
                    </div>
                  </div>
                </dl>
                <Link
                  className={cn(
                    buttonVariants({ intent: 'primary', size: 'lg' }),
                    'mt-5 w-full',
                  )}
                  href={`/technician/orders/${job.id}`}
                >
                  Mở công việc
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </article>
            ))}
          </div>
        )}

        <nav
          aria-label="Phan trang cong viec"
          className="flex items-center justify-between border-t px-4 py-3"
        >
          <span className="text-xs text-[var(--muted)]">
            Trang {cursorIndex + 1}
          </span>
          <div className="flex gap-2">
            <Button
              aria-label="Trang truoc"
              disabled={loading || cursorIndex === 0}
              intent="secondary"
              onClick={previous}
              size="icon"
              type="button"
            >
              <ArrowLeft size={16} />
            </Button>
            <Button
              aria-label="Trang sau"
              disabled={loading || !jobs?.nextCursor}
              intent="secondary"
              onClick={next}
              size="icon"
              type="button"
            >
              <ArrowRight size={16} />
            </Button>
          </div>
        </nav>
      </Card>
    </main>
  );
}

function JobTimeline({ detail }: { detail: JobDetail }) {
  const timeline = buildTechnicianTimeline(detail);
  return (
    <ol className="mt-4 space-y-0" aria-label="Tiến độ công việc">
      {timeline.map((step, index) => {
        const { complete, timestamp } = step;
        return (
          <li className="relative flex gap-3 pb-5 last:pb-0" key={step.key}>
            {index < timeline.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-6 left-[11px] h-[calc(100%-16px)] w-0.5',
                  complete ? 'bg-[var(--success)]' : 'bg-[var(--border)]',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border',
                complete
                  ? 'border-[var(--success)] bg-[var(--success)] text-white'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]',
              )}
            >
              {complete ? (
                <Check aria-hidden="true" size={14} />
              ) : (
                <CircleDot aria-hidden="true" size={12} />
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  'text-sm font-medium',
                  !complete && 'text-[var(--muted)]',
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {timestamp ? formatDate(timestamp) : 'Chưa thực hiện'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TechnicianOrderDetail({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionOption | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [job, actionOptions] = await Promise.all([
        request<JobDetail>(`/api/v1/technician/assignments/${assignmentId}`),
        request<{ actions: ActionOption[] }>(
          `/api/v1/technician/assignments/${assignmentId}/actions`,
        ),
      ]);
      setDetail(job);
      setActions(actionOptions.actions);
      setCompletionNote(job.completionNote ?? '');
    } catch (requestError: unknown) {
      setDetail(null);
      setActions([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể tải chi tiết công việc.',
      );
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    queueMicrotask(() => void loadDetail());
  }, [loadDetail]);

  const runAction = useCallback(async () => {
    if (!detail || !pendingAction) return;
    const action = pendingAction;
    setActionLoading(action.action);
    setError(null);
    setSuccess(null);
    try {
      await request(`/api/v1/technician/assignments/${detail.id}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          action: action.action,
          expectedVersion: detail.appointment.version,
          ...(action.requiresNote ? { note: completionNote } : {}),
        }),
      });
      setPendingAction(null);
      await loadDetail();
      setSuccess(`${actionPresentation[action.action].label} thành công.`);
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Cập nhật trạng thái thất bại.';
      setPendingAction(null);
      await loadDetail();
      setError(message);
    } finally {
      setActionLoading(null);
    }
  }, [completionNote, detail, loadDetail, pendingAction]);

  const uploadEvidence = useCallback(async () => {
    if (!detail || !evidenceFile) return;
    const extension = evidenceFile.name.split('.').at(-1)?.toLowerCase() ?? '';
    if (
      !allowedMimeTypes.includes(evidenceFile.type) ||
      !allowedExtensions.includes(extension) ||
      evidenceFile.size > maxEvidenceBytes
    ) {
      setUploadError('Tệp ảnh phải là JPG, PNG hoặc WebP và không quá 5 MB.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setSuccess(null);
    try {
      await request(`/api/v1/technician/assignments/${detail.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          filename: evidenceFile.name,
          contentType: evidenceFile.type,
          contentBase64: await readFileAsBase64(evidenceFile),
        }),
      });
      setEvidenceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDetail();
      setSuccess('Ảnh nghiệm thu đã được lưu.');
    } catch (requestError: unknown) {
      setUploadError(
        requestError instanceof Error
          ? requestError.message
          : 'Tải evidence thất bại.',
      );
    } finally {
      setUploading(false);
    }
  }, [detail, evidenceFile, loadDetail]);

  if (loading)
    return (
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Loading
          className="min-h-[60vh]"
          label="Đang tải chi tiết công việc..."
        />
      </main>
    );

  if (!detail)
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Alert title="Không thể mở công việc" variant="error">
          {error ??
            'Công việc không tồn tại hoặc không thuộc assignment của bạn.'}
        </Alert>
        <Link
          className={cn(buttonVariants({ intent: 'secondary' }), 'mt-5')}
          href="/technician/orders"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          Về danh sách
        </Link>
      </main>
    );

  const noteRequired = actions.some((action) => action.requiresNote);

  return (
    <main className="mx-auto min-h-0 max-w-6xl px-4 py-6 pb-36 sm:px-6 md:pb-24 lg:px-8">
      <PageHeader
        description="Thông tin cần thiết để thực hiện lắp đặt và cập nhật tiến độ."
        title="Chi tiết công việc"
      >
        <Link
          className={buttonVariants({ intent: 'secondary' })}
          href="/technician/orders"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          Danh sách
        </Link>
      </PageHeader>

      {error ? (
        <Alert className="mt-5" variant="error">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert className="mt-5" variant="success">
          {success}
        </Alert>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    ĐƠN HÀNG
                  </p>
                  <h2 className="mt-1 text-lg font-bold break-all text-[var(--primary)]">
                    {detail.appointment.order.orderNumber}
                  </h2>
                </div>
                <OperationsStatusBadge
                  kind="appointment"
                  status={detail.appointment.status}
                />
              </div>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div className="flex gap-3">
                  <Clock3
                    aria-hidden="true"
                    className="shrink-0 text-[var(--primary)]"
                    size={18}
                  />
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Khung giờ</dt>
                    <dd className="mt-1">
                      {formatDate(detail.appointment.scheduledStartAt)}
                    </dd>
                    <dd className="text-xs text-[var(--muted)]">
                      đến {formatDate(detail.appointment.scheduledEndAt)}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin
                    aria-hidden="true"
                    className="shrink-0 text-[var(--primary)]"
                    size={18}
                  />
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Khu vực</dt>
                    <dd className="mt-1">
                      {detail.appointment.serviceArea.districtName}
                    </dd>
                    <dd className="text-xs text-[var(--muted)]">
                      {detail.appointment.serviceArea.provinceName}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <UserRound aria-hidden="true" size={18} /> Khách hàng và địa chỉ
              </h2>
              <p className="mt-4 font-medium">
                {detail.appointment.order.recipientName}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {detail.appointment.order.addressLine1},{' '}
                {detail.appointment.order.wardName},{' '}
                {detail.appointment.order.districtName},{' '}
                {detail.appointment.order.provinceName}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <PackageCheck aria-hidden="true" size={18} /> Thiết bị và dịch
                vụ
              </h2>
              <ul className="mt-4 divide-y rounded-lg border text-sm">
                {detail.appointment.order.items.map((item) => (
                  <li className="px-3 py-3" key={item.id}>
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">
                        {item.productName} / {item.variantName}
                      </span>
                      <Badge>x {item.quantity}</Badge>
                    </div>
                    {item.servicePackageName ? (
                      <p className="mt-1 text-[var(--muted)]">
                        {item.servicePackageName}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <h2 className="font-semibold">Ghi chú vận hành</h2>
              <p className="mt-3 text-sm whitespace-pre-wrap text-[var(--muted)]">
                {detail.appointment.customerNote ??
                  'Không có ghi chú từ khách hàng.'}
              </p>
              {detail.completionNote ? (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    KẾT QUẢ THỰC HIỆN
                  </p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">
                    {detail.completionNote}
                  </p>
                </div>
              ) : null}
              {noteRequired ? (
                <label className="mt-4 block text-sm font-medium">
                  Ghi chu ket qua
                  <Textarea
                    aria-describedby="completion-note-help"
                    className="mt-1"
                    maxLength={1000}
                    onChange={(event) => setCompletionNote(event.target.value)}
                    placeholder="Mô tả kết quả lắp đặt và kiểm tra nghiệm thu"
                    value={completionNote}
                  />
                  <span
                    className="mt-1 block text-xs text-[var(--muted)]"
                    id="completion-note-help"
                  >
                    Ghi chú được lưu cùng action hoàn thành. Tối đa 1.000 ký tự.
                  </span>
                </label>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <ImageIcon aria-hidden="true" size={18} /> Ảnh nghiệm thu
                </h2>
                <Badge>{detail.evidence.length} tệp</Badge>
              </div>
              {detail.evidence.length ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {detail.evidence.map((item) => (
                    <a
                      className="group block overflow-hidden rounded-md border bg-[var(--surface)]"
                      href={`/api/v1/operations/evidence/${item.id}`}
                      key={item.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="relative block aspect-square w-full overflow-hidden bg-[var(--surface-subtle)]">
                        <Image
                          alt={`Evidence ${formatDate(item.createdAt)}`}
                          className="object-cover transition-transform group-hover:scale-105"
                          fill
                          sizes="(min-width: 640px) 220px, 45vw"
                          src={`/api/v1/operations/evidence/${item.id}`}
                          unoptimized
                        />
                      </span>
                      <span className="block px-2 py-2 text-xs text-[var(--muted)]">
                        {Math.ceil(item.byteSize / 1024)} KB ·{' '}
                        {formatDate(item.createdAt)}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="mt-3 min-h-36"
                  description="Ảnh sẽ hiển thị tại đây sau khi tải lên thành công."
                  icon={<Camera aria-hidden="true" size={20} />}
                  title="Chưa có ảnh nghiệm thu"
                />
              )}
              {detail.status === 'ACTIVE' ? (
                <div className="mt-4 rounded-lg border bg-[var(--surface-subtle)] p-3">
                  <label className="block text-sm font-medium">
                    Anh nghiem thu
                    <Input
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-1 h-auto min-h-11 py-2"
                      onChange={(event) =>
                        setEvidenceFile(event.target.files?.[0] ?? null)
                      }
                      ref={fileInputRef}
                      type="file"
                    />
                  </label>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    JPG, PNG hoặc WebP; tối đa 5 MB.
                  </p>
                  <Button
                    className="mt-3 min-h-11 w-full sm:w-auto"
                    disabled={!evidenceFile}
                    loading={uploading}
                    onClick={() => void uploadEvidence()}
                    type="button"
                  >
                    <Camera aria-hidden="true" size={16} />
                    Tai evidence
                  </Button>
                  {uploadError ? (
                    <Alert className="mt-3" variant="error">
                      {uploadError}
                    </Alert>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="self-start lg:sticky lg:top-20">
          <Card>
            <CardContent className="p-4 sm:p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <ShieldCheck aria-hidden="true" size={18} /> Tiến độ công việc
              </h2>
              <JobTimeline detail={detail} />
            </CardContent>
          </Card>
        </aside>
      </section>

      <section
        aria-label="Thao tác công việc"
        className="fixed inset-x-0 bottom-14 z-30 border-t bg-[var(--surface)]/95 px-3 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur md:bottom-0 lg:static lg:mt-5 lg:rounded-lg lg:border lg:px-5 lg:shadow-none"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <div className="mr-auto hidden sm:block">
            <p className="text-sm font-semibold">Cập nhật công việc</p>
            <p className="text-xs text-[var(--muted)]">
              Action hợp lệ được trả về từ server.
            </p>
          </div>
          {actions.map((action) => {
            const presentation = actionPresentation[action.action];
            const Icon = presentation.icon;
            return (
              <Button
                className="min-h-12 flex-1 sm:flex-none"
                disabled={
                  actionLoading !== null ||
                  (action.requiresNote && completionNote.trim().length < 3)
                }
                key={action.action}
                onClick={() => setPendingAction(action)}
                size="lg"
                type="button"
              >
                <Icon aria-hidden="true" className="size-5" />
                {presentation.label}
              </Button>
            );
          })}
          {!actions.length ? (
            <p className="w-full py-2 text-center text-sm text-[var(--muted)]">
              Không có action hợp lệ ở trạng thái hiện tại.
            </p>
          ) : null}
        </div>
      </section>

      {pendingAction ? (
        <ConfirmDialog
          action={pendingAction}
          loading={actionLoading !== null}
          onClose={() => setPendingAction(null)}
          onConfirm={() => void runAction()}
        />
      ) : null}
    </main>
  );
}

export function TechnicianConsole() {
  return <TechnicianOrdersList />;
}
