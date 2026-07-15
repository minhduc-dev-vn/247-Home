import Link from 'next/link';
import { listOrders } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';
import { formatVnd } from '@/shared/money/format-vnd';
export const dynamic = 'force-dynamic';
export default async function OrdersPage() {
  const orders = await listOrders(await requirePageActor());
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <Link
        className="text-sm font-medium text-[var(--primary)]"
        href="/products"
      >
        247 Home
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Don hang cua toi</h1>
      <div className="mt-8 divide-y border bg-white">
        {orders.items.map((order) => (
          <Link
            className="flex justify-between gap-4 p-4"
            href={`/orders/${order.id}`}
            key={order.id}
          >
            <span>
              {order.orderNumber} · {order.status}
            </span>
            <strong>{formatVnd(order.grandTotal)}</strong>
          </Link>
        ))}
      </div>
    </main>
  );
}
