import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';
export const dynamic = 'force-dynamic';
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const order = await getOrder(await requirePageActor(), (await params).id);
  if (!order) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <p className="text-sm font-medium text-[var(--primary)]">
        Dat hang thanh cong
      </p>
      <h1 className="mt-3 text-3xl font-semibold">{order.orderNumber}</h1>
      <p className="mt-4 text-[var(--muted)]">
        Thanh toan {order.payment.method}. Trang thai hien tai: {order.status}.
      </p>
      <Link
        className="mt-8 inline-block border px-4 py-2 font-medium"
        href={`/orders/${order.id}`}
      >
        Xem chi tiet don
      </Link>
    </main>
  );
}
