import Link from 'next/link';
import { CheckoutFlow } from '@/components/commerce/checkout-flow';
import { getCart, listAddresses } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';
export const dynamic = 'force-dynamic';
export default async function CheckoutPage() {
  const actor = await requirePageActor();
  const [cart, addresses] = await Promise.all([
    getCart(actor),
    listAddresses(actor),
  ]);
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <Link className="text-sm font-medium text-[var(--primary)]" href="/cart">
        Gio hang
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Checkout</h1>
      <section className="mt-8 border bg-white p-5">
        <h2 className="font-semibold">San pham da chon</h2>
        {cart.items.map((item) => (
          <p className="mt-3 text-sm" key={item.id}>
            {item.name} · {item.quantity}
          </p>
        ))}
      </section>
      <CheckoutFlow cart={cart} initialAddresses={addresses.items} />
    </main>
  );
}
