import Link from 'next/link';
import { getCart } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';
import { formatVnd } from '@/shared/money/format-vnd';
export const dynamic = 'force-dynamic';
export default async function CartPage() {
  const cart = await getCart(await requirePageActor());
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="flex items-center justify-between border-b pb-5">
        <Link className="font-semibold text-[var(--primary)]" href="/products">
          San pham
        </Link>
        <h1 className="text-2xl font-semibold">Gio hang</h1>
      </header>
      <div className="mt-8 divide-y border bg-white">
        {cart.items.map((item) => (
          <div
            className="flex items-center justify-between gap-4 p-4"
            key={item.id}
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {item.servicePackageName ?? 'Khong kem lap dat'} · SL{' '}
                {item.quantity}
              </p>
            </div>
            <p>
              {formatVnd(
                BigInt(item.deviceUnitPrice) + BigInt(item.serviceUnitPrice),
              )}
            </p>
          </div>
        ))}
      </div>
      {cart.items.length ? (
        <Link
          className="mt-6 inline-block bg-[var(--primary)] px-4 py-2 font-medium text-white"
          href="/checkout"
        >
          Tiep tuc checkout
        </Link>
      ) : (
        <p className="mt-6 text-[var(--muted)]">Gio hang dang trong.</p>
      )}
    </main>
  );
}
