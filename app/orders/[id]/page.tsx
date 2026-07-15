import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';
import { formatServiceDateTime } from '@/shared/date/service-time';
import { formatVnd } from '@/shared/money/format-vnd';
export const dynamic = 'force-dynamic';
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const order = await getOrder(await requirePageActor(), (await params).id);
  if (!order) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <Link
        className="text-sm font-medium text-[var(--primary)]"
        href="/orders"
      >
        Don hang
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">{order.orderNumber}</h1>
      <p className="mt-3">
        {order.status} · {order.payment.method} / {order.payment.status}
      </p>
      <div className="mt-8 divide-y border bg-white">
        {order.items.map((item) => (
          <div className="flex justify-between p-4" key={item.id}>
            <span>
              {item.productName} - {item.variantName} × {item.quantity}
            </span>
            <strong>{formatVnd(item.lineTotal)}</strong>
          </div>
        ))}
      </div>
      {order.appointment ? (
        <p className="mt-6 border p-4">
          Lich lap dat: {order.appointment.status} ·{' '}
          {formatServiceDateTime(order.appointment.scheduledStartAt)}
        </p>
      ) : null}
    </main>
  );
}
