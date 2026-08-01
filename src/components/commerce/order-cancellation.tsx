'use client';

import { CircleX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ApiError = { error?: { code?: string; message?: string } };

async function cancellationError(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  if (body?.error?.code === 'CONCURRENT_MODIFICATION')
    return 'Đơn hàng vừa được cập nhật. Trang đã tải lại trạng thái mới.';
  if (
    body?.error?.code === 'INVALID_STATE_TRANSITION' ||
    body?.error?.code === 'INVENTORY_CONFLICT' ||
    body?.error?.code === 'SLOT_UNAVAILABLE'
  )
    return 'Đơn hàng hiện không thể hủy. Trang đã tải lại trạng thái mới.';
  return body?.error?.message ?? 'Không thể hủy đơn hàng. Vui lòng thử lại.';
}

export function OrderCancellationAction({
  orderId,
  expectedVersion,
}: {
  orderId: string;
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
      const response = await fetch(`/api/v1/orders/${orderId}/actions/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion,
          reason: form.get('reason'),
        }),
      });
      if (!response.ok) throw new Error(await cancellationError(response));
      setConfirming(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể hủy đơn hàng. Vui lòng thử lại.',
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button intent="danger" onClick={() => setConfirming(true)} type="button">
        <CircleX aria-hidden="true" className="size-4" />
        Hủy đơn hàng
      </Button>
    );
  }

  return (
    <form
      aria-busy={pending || undefined}
      aria-describedby={error ? 'order-cancellation-error' : undefined}
      className="rounded-md border border-[var(--error)] bg-[var(--error-soft)] p-4"
      onSubmit={submit}
    >
      <p className="font-semibold">Xác nhận hủy đơn hàng?</p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Hàng đã giữ và lịch lắp đặt (nếu có) sẽ được giải phóng sau khi hệ thống
        xác nhận hủy đơn.
      </p>
      <label
        className="mt-4 block text-sm font-semibold"
        htmlFor="order-cancellation-reason"
      >
        Lý do hủy đơn
      </label>
      <Textarea
        className="mt-2"
        disabled={pending}
        id="order-cancellation-reason"
        maxLength={300}
        minLength={3}
        name="reason"
        required
      />
      {error ? (
        <Alert className="mt-3" id="order-cancellation-error" variant="error">
          {error}
        </Alert>
      ) : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button intent="danger" loading={pending} type="submit">
          Xác nhận hủy đơn
        </Button>
        <Button
          disabled={pending}
          intent="secondary"
          onClick={() => setConfirming(false)}
          type="button"
        >
          Quay lại
        </Button>
      </div>
    </form>
  );
}
