'use client';

import {
  CheckCircle2,
  FileImage,
  LoaderCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  warrantyCoverageLabels,
  warrantyIssueLabels,
} from '@/components/warranty/warranty-presentation';

type ApiErrorBody = { error?: { code?: string; message?: string } };

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const code = body?.error?.code;
  if (code === 'CONCURRENT_MODIFICATION') {
    return 'Dữ liệu vừa được cập nhật ở nơi khác. Trang sẽ tải lại trạng thái mới.';
  }
  if (code === 'WARRANTY_NOT_ELIGIBLE') {
    return 'Sản phẩm không còn đủ điều kiện bảo hành.';
  }
  if (code === 'CONFLICT') {
    return 'Yêu cầu bảo hành cho hạng mục này đã tồn tại.';
  }
  if (code === 'PAYLOAD_TOO_LARGE')
    return 'Tệp tải lên vượt quá dung lượng cho phép.';
  if (code === 'UNSUPPORTED_MEDIA_TYPE')
    return 'Định dạng tệp không được hỗ trợ.';
  return (
    body?.error?.message ?? 'Không thể hoàn tất thao tác. Vui lòng thử lại.'
  );
}

export type EligibleWarrantyItem = {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productName: string;
  variantName: string;
  servicePackageName: string | null;
  coverageType: 'DEVICE' | 'INSTALLATION';
  warrantyStartsAt: Date;
  warrantyExpiresAt: Date;
};

export function WarrantyCreateForm({
  items,
}: {
  items: EligibleWarrantyItem[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState(items[0]?.orderItemId ?? '');
  const idempotencyKey = useRef<string | undefined>(undefined);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const candidate = items.find(
      (item) =>
        `${item.orderItemId}:${item.coverageType}` === form.get('candidate'),
    );
    if (!candidate) {
      setError('Vui lòng chọn hạng mục cần bảo hành.');
      return;
    }
    setPending(true);
    setError(undefined);
    idempotencyKey.current ??= `warranty_${crypto.randomUUID().replaceAll('-', '')}`;
    try {
      const response = await fetch('/api/v1/warranty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.current,
        },
        body: JSON.stringify({
          orderItemId: candidate.orderItemId,
          coverageType: candidate.coverageType,
          issueType: form.get('issueType'),
          description: form.get('description'),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = (await response.json()) as { data: { id: string } };
      router.push(`/warranty/${body.data.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Không thể tạo yêu cầu.',
      );
      idempotencyKey.current = undefined;
      setPending(false);
    }
  }

  if (!items.length) {
    return (
      <Alert title="Chưa có hạng mục đủ điều kiện" variant="info">
        Bảo hành chỉ có thể được tạo cho đơn đã hoàn tất, còn thời hạn và chưa
        có yêu cầu trùng lặp.
      </Alert>
    );
  }

  return (
    <form
      aria-describedby={error ? 'warranty-create-error' : undefined}
      onSubmit={submit}
    >
      <div className="grid gap-4">
        <div>
          <label className="text-sm font-semibold" htmlFor="warranty-candidate">
            Sản phẩm hoặc dịch vụ
          </label>
          <Select
            className="mt-2"
            id="warranty-candidate"
            name="candidate"
            onChange={(event) =>
              setSelected(event.target.value.split(':')[0] ?? '')
            }
            required
          >
            {items.map((item) => (
              <option
                key={`${item.orderItemId}:${item.coverageType}`}
                value={`${item.orderItemId}:${item.coverageType}`}
              >
                {item.orderNumber} - {item.productName} -{' '}
                {warrantyCoverageLabels[item.coverageType]}
              </option>
            ))}
          </Select>
          {selected ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Điều kiện đã được kiểm tra từ dữ liệu đơn hàng trên server.
            </p>
          ) : null}
        </div>
        <div>
          <label
            className="text-sm font-semibold"
            htmlFor="warranty-issue-type"
          >
            Vấn đề cần hỗ trợ
          </label>
          <Select
            className="mt-2"
            id="warranty-issue-type"
            name="issueType"
            required
          >
            {Object.entries(warrantyIssueLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            className="text-sm font-semibold"
            htmlFor="warranty-description"
          >
            Mô tả chi tiết
          </label>
          <Textarea
            className="mt-2"
            id="warranty-description"
            maxLength={2000}
            minLength={20}
            name="description"
            placeholder="Mô tả hiện tượng, thời điểm xảy ra và các bước đã thử..."
            required
          />
        </div>
        {error ? (
          <Alert id="warranty-create-error" variant="error">
            {error}
          </Alert>
        ) : null}
        <Button className="w-full sm:w-fit" disabled={pending} type="submit">
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="size-4" />
          )}
          {pending ? 'Đang gửi...' : 'Gửi yêu cầu bảo hành'}
        </Button>
      </div>
    </form>
  );
}

export function WarrantyEvidenceUploader({
  requestId,
  expectedVersion,
}: {
  requestId: string;
  expectedVersion: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('evidence');
    if (!(file instanceof File) || !file.size) {
      setError('Vui lòng chọn một tệp ảnh.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh không được vượt quá 5 MB.');
      return;
    }
    setPending(true);
    setError(undefined);
    setSuccess(false);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const response = await fetch(`/api/v1/warranty/${requestId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion,
          filename: file.name,
          contentType: file.type,
          contentBase64: dataUrl.split(',')[1],
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setSuccess(true);
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Không thể tải ảnh lên.',
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="text-sm font-semibold" htmlFor="warranty-evidence">
        Ảnh hiện trạng
      </label>
      <Input
        accept="image/jpeg,image/png,image/webp"
        className="mt-2 h-auto py-2"
        id="warranty-evidence"
        name="evidence"
        type="file"
      />
      <p className="mt-2 text-xs text-[var(--muted)]">
        JPEG, PNG hoặc WebP, tối đa 5 MB.
      </p>
      {error ? (
        <Alert className="mt-3" variant="error">
          {error}
        </Alert>
      ) : null}
      {success ? (
        <Alert className="mt-3" variant="success">
          <CheckCircle2 aria-hidden="true" className="sr-only" />
          Ảnh đã được lưu an toàn.
        </Alert>
      ) : null}
      <Button
        className="mt-4 w-full sm:w-fit"
        disabled={pending}
        intent="secondary"
        type="submit"
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <FileImage aria-hidden="true" className="size-4" />
        )}
        {pending ? 'Đang tải lên...' : 'Tải ảnh lên'}
      </Button>
    </form>
  );
}

export function WarrantyCloseAction({
  requestId,
  expectedVersion,
}: {
  requestId: string;
  expectedVersion: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/v1/warranty/${requestId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion,
          nextStatus: 'CLOSED',
          reason: form.get('reason'),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Không thể đóng yêu cầu.',
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button onClick={() => setConfirming(true)}>
        <ShieldCheck aria-hidden="true" className="size-4" />
        Xác nhận đã nhận kết quả
      </Button>
    );
  }
  return (
    <form
      className="rounded-lg border bg-[var(--surface-subtle)] p-4"
      onSubmit={submit}
    >
      <p className="font-semibold">Đóng yêu cầu bảo hành?</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Chỉ xác nhận khi bạn đã nhận được kết quả xử lý.
      </p>
      <label
        className="mt-4 block text-sm font-semibold"
        htmlFor="warranty-close-reason"
      >
        Ghi chú xác nhận
      </label>
      <Textarea
        className="mt-2"
        id="warranty-close-reason"
        maxLength={500}
        minLength={3}
        name="reason"
        required
      />
      {error ? (
        <Alert className="mt-3" variant="error">
          {error}
        </Alert>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button disabled={pending} type="submit">
          {pending ? 'Đang xác nhận...' : 'Đóng yêu cầu'}
        </Button>
        <Button
          disabled={pending}
          intent="secondary"
          onClick={() => setConfirming(false)}
          type="button"
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}
