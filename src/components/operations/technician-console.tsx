'use client';

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  ClipboardList,
  MapPin,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
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
type ActionOption = { action: string; label: string; requiresNote: boolean };
type ApiError = { error?: { message?: string } };

const appointmentStatuses = [
  'ASSIGNED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
];
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
const maxEvidenceBytes = 5 * 1024 * 1024;

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
    throw new Error(errorMessage(body, 'Khong the xu ly yeu cau.'));
  return body.data;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Khong the doc tep anh.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Khong the doc tep anh.'));
        return;
      }
      resolve(reader.result.split(',', 2)[1] ?? '');
    };
    reader.readAsDataURL(file);
  });
}

function Dialog({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  const titleId = useId();
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-md bg-white shadow-xl"
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

export function TechnicianConsole() {
  const [status, setStatus] = useState('');
  const [jobs, setJobs] = useState<Page<JobRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursors, setCursors] = useState(['']);
  const [cursorIndex, setCursorIndex] = useState(0);
  const cursorIndexRef = useRef(0);
  const requestSequence = useRef(0);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
              : 'Khong the tai cong viec.',
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

  const loadDetail = useCallback(async (assignmentId: string) => {
    setDetailLoading(true);
    setDetailError(null);
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
      setEvidenceFile(null);
      setUploadError(null);
    } catch (requestError: unknown) {
      setDetailError(
        requestError instanceof Error
          ? requestError.message
          : 'Khong the tai chi tiet cong viec.',
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const runAction = useCallback(
    async (option: ActionOption) => {
      if (!detail) return;
      setActionLoading(option.action);
      setDetailError(null);
      try {
        await request(`/api/v1/technician/assignments/${detail.id}/actions`, {
          method: 'POST',
          body: JSON.stringify({
            action: option.action,
            expectedVersion: detail.appointment.version,
            ...(option.requiresNote ? { note: completionNote } : {}),
          }),
        });
        await Promise.all([loadDetail(detail.id), loadJobs()]);
      } catch (requestError: unknown) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Cap nhat trang thai that bai.';
        await Promise.all([loadDetail(detail.id), loadJobs()]);
        setDetailError(message);
      } finally {
        setActionLoading(null);
      }
    },
    [completionNote, detail, loadDetail, loadJobs],
  );

  const uploadEvidence = useCallback(async () => {
    if (!detail || !evidenceFile) return;
    const extension = evidenceFile.name.split('.').at(-1)?.toLowerCase() ?? '';
    if (
      !allowedMimeTypes.includes(evidenceFile.type) ||
      !allowedExtensions.includes(extension) ||
      evidenceFile.size > maxEvidenceBytes
    ) {
      setUploadError('Tep anh phai la JPG, PNG hoac WebP va khong qua 5 MB.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      await request(`/api/v1/technician/assignments/${detail.id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          filename: evidenceFile.name,
          contentType: evidenceFile.type,
          contentBase64: await readFileAsBase64(evidenceFile),
        }),
      });
      await loadDetail(detail.id);
    } catch (requestError: unknown) {
      setUploadError(
        requestError instanceof Error
          ? requestError.message
          : 'Tai evidence that bai.',
      );
    } finally {
      setUploading(false);
    }
  }, [detail, evidenceFile, loadDetail]);

  const next = () => {
    if (jobs?.nextCursor) void loadJobs(jobs.nextCursor, 'next');
  };
  const previous = () => {
    if (cursorIndex > 0) void loadJobs(cursors[cursorIndex - 1], 'previous');
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-8">
      <header className="border-b pb-6">
        <p className="text-sm font-medium text-[var(--primary)]">
          247 Home / Ky thuat vien
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Cong viec cua toi</h1>
      </header>
      <section
        className="mt-6 border bg-white"
        aria-label="Danh sach cong viec"
      >
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <h2 className="font-semibold">Lich lap dat</h2>
          <label className="ml-auto flex items-center gap-2 text-sm">
            Trang thai
            <select
              className="h-9 rounded-md border bg-white px-2"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">Tat ca</option>
              {appointmentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            Dang tai cong viec...
          </p>
        ) : error ? (
          <p
            className="m-4 flex items-center gap-2 border border-[#dc5656] bg-[#fff4f4] px-3 py-3 text-sm text-[#8b1e1e]"
            role="alert"
          >
            <AlertCircle size={16} />
            {error}
          </p>
        ) : !jobs?.items.length ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            Khong co cong viec phu hop.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#f7f8fa] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Don hang</th>
                  <th>Thoi gian</th>
                  <th>Khu vuc</th>
                  <th>Trang thai</th>
                  <th className="px-4 py-3 text-right">Thao tac</th>
                </tr>
              </thead>
              <tbody>
                {jobs.items.map((job) => (
                  <tr className="border-t" key={job.id}>
                    <td className="px-4 py-3 font-medium">
                      {job.appointment.order.orderNumber}
                    </td>
                    <td>{formatDate(job.appointment.scheduledStartAt)}</td>
                    <td>{job.appointment.serviceArea.districtName}</td>
                    <td>{job.appointment.status}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        onClick={() => void loadDetail(job.id)}
                        size="sm"
                        type="button"
                      >
                        <ClipboardList size={15} />
                        Chi tiet
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav
          aria-label="Phan trang cong viec"
          className="flex justify-end gap-2 border-t px-4 py-3"
        >
          <Button
            aria-label="Trang truoc"
            disabled={loading || cursorIndex === 0}
            onClick={previous}
            size="sm"
            type="button"
          >
            <ArrowLeft size={16} />
          </Button>
          <Button
            aria-label="Trang sau"
            disabled={loading || !jobs?.nextCursor}
            onClick={next}
            size="sm"
            type="button"
          >
            <ArrowRight size={16} />
          </Button>
        </nav>
      </section>
      {(detail || detailLoading || detailError) && (
        <Dialog
          onClose={() => {
            setDetail(null);
            setDetailError(null);
            setActions([]);
          }}
          title="Chi tiet cong viec"
        >
          {detailLoading && (
            <p className="text-sm text-[var(--muted)]">Dang tai chi tiet...</p>
          )}
          {detailError && (
            <p
              className="mb-4 flex items-center gap-2 border border-[#dc5656] bg-[#fff4f4] px-3 py-3 text-sm text-[#8b1e1e]"
              role="alert"
            >
              <AlertCircle size={16} />
              {detailError}
            </p>
          )}
          {detail && (
            <div className="space-y-6">
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-[var(--muted)]">Don hang</span>
                  <br />
                  <strong>{detail.appointment.order.orderNumber}</strong>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Trang thai</span>
                  <br />
                  <strong>{detail.appointment.status}</strong>
                </p>
                <p>
                  <span className="text-[var(--muted)]">Khung gio</span>
                  <br />
                  {formatDate(detail.appointment.scheduledStartAt)} -{' '}
                  {formatDate(detail.appointment.scheduledEndAt)}
                </p>
                <p>
                  <span className="text-[var(--muted)]">Khu vuc</span>
                  <br />
                  {detail.appointment.serviceArea.districtName},{' '}
                  {detail.appointment.serviceArea.provinceName}
                </p>
              </div>
              <section>
                <h3 className="font-semibold">
                  Khach hang va dia chi thi cong
                </h3>
                <div className="mt-2 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 shrink-0" size={16} />
                  <p>
                    {detail.appointment.order.recipientName}
                    <br />
                    {detail.appointment.order.addressLine1},{' '}
                    {detail.appointment.order.wardName},{' '}
                    {detail.appointment.order.districtName},{' '}
                    {detail.appointment.order.provinceName}
                  </p>
                </div>
              </section>
              <section>
                <h3 className="font-semibold">San pham va goi lap dat</h3>
                <ul className="mt-2 divide-y border text-sm">
                  {detail.appointment.order.items.map((item) => (
                    <li className="px-3 py-2" key={item.id}>
                      {item.productName} / {item.variantName} x {item.quantity}
                      {item.servicePackageName ? (
                        <span className="block text-[var(--muted)]">
                          {item.servicePackageName}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="font-semibold">Ghi chu van hanh</h3>
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {detail.appointment.customerNote ?? 'Khong co ghi chu.'}
                </p>
                {detail.completionNote ? (
                  <p className="mt-2 border-t pt-2 text-sm whitespace-pre-wrap">
                    Ket qua: {detail.completionNote}
                  </p>
                ) : null}
              </section>
              <section>
                <h3 className="font-semibold">Timeline</h3>
                <ol className="mt-2 space-y-1 text-sm">
                  <li>Phan cong: {formatDate(detail.assignedAt)}</li>
                  {detail.acceptedAt ? (
                    <li>Nhan viec: {formatDate(detail.acceptedAt)}</li>
                  ) : null}
                  {detail.enRouteAt ? (
                    <li>Bat dau di chuyen: {formatDate(detail.enRouteAt)}</li>
                  ) : null}
                  {detail.arrivedAt ? (
                    <li>Da den: {formatDate(detail.arrivedAt)}</li>
                  ) : null}
                  {detail.startedAt ? (
                    <li>Bat dau cong viec: {formatDate(detail.startedAt)}</li>
                  ) : null}
                  {detail.completedAt ? (
                    <li>Hoan thanh: {formatDate(detail.completedAt)}</li>
                  ) : null}
                </ol>
              </section>
              <section>
                <h3 className="font-semibold">Evidence</h3>
                {detail.evidence.length ? (
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {detail.evidence.map((item) => (
                      <a
                        className="block border p-2"
                        href={`/api/v1/operations/evidence/${item.id}`}
                        key={item.id}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <span className="relative block aspect-[20/7] w-full">
                          <Image
                            alt={`Evidence ${formatDate(item.createdAt)}`}
                            className="object-cover"
                            fill
                            sizes="(min-width: 640px) 240px, 45vw"
                            src={`/api/v1/operations/evidence/${item.id}`}
                            unoptimized
                          />
                        </span>
                        <span className="mt-1 block text-xs text-[var(--muted)]">
                          {formatDate(item.createdAt)} -{' '}
                          {Math.ceil(item.byteSize / 1024)} KB
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Chua co evidence.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="block text-sm">
                    Anh nghiem thu
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-1 block text-sm"
                      onChange={(event) =>
                        setEvidenceFile(event.target.files?.[0] ?? null)
                      }
                      type="file"
                    />
                  </label>
                  <Button
                    disabled={!evidenceFile || uploading}
                    onClick={() => void uploadEvidence()}
                    type="button"
                  >
                    <Camera size={16} />
                    {uploading ? 'Dang tai len...' : 'Tai evidence'}
                  </Button>
                </div>
                {uploadError ? (
                  <p className="mt-2 text-sm text-[#8b1e1e]" role="alert">
                    {uploadError}
                  </p>
                ) : null}
              </section>
              <section>
                <h3 className="font-semibold">Cap nhat cong viec</h3>
                {actions.some((action) => action.requiresNote) ? (
                  <label className="mt-2 block text-sm">
                    Ghi chu ket qua
                    <textarea
                      className="mt-1 block w-full rounded-md border p-2"
                      maxLength={1000}
                      onChange={(event) =>
                        setCompletionNote(event.target.value)
                      }
                      value={completionNote}
                    />
                  </label>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {actions.map((action) => (
                    <Button
                      disabled={
                        actionLoading !== null ||
                        (action.requiresNote &&
                          completionNote.trim().length < 3)
                      }
                      key={action.action}
                      onClick={() => void runAction(action)}
                      type="button"
                    >
                      {actionLoading === action.action
                        ? 'Dang cap nhat...'
                        : action.label}
                    </Button>
                  ))}
                </div>
                {!actions.length ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Khong co action hop le theo state hien tai.
                  </p>
                ) : null}
              </section>
            </div>
          )}
        </Dialog>
      )}
    </main>
  );
}
