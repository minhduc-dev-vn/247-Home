import { ClipboardCheck } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

import { CheckoutFlow } from '@/components/commerce/checkout-flow';
import { Container } from '@/components/layout/container';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { getCart, listAddresses } from '@/modules/commerce';
import { getOwnProfile } from '@/modules/identity';
import { requirePageActor } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const actor = await requirePageActor();
  const [cart, addresses, profile] = await Promise.all([
    getCart(actor),
    listAddresses(actor),
    getOwnProfile(actor, actor.userId),
  ]);

  if (!profile) notFound();
  if (cart.items.length === 0) redirect('/cart');

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container>
          <Breadcrumb
            items={[
              { href: '/', label: 'Trang chủ' },
              { href: '/cart', label: 'Giỏ hàng' },
              { label: 'Checkout' },
            ]}
          />
          <div className="mt-7 flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <ClipboardCheck aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">
                Hoàn tất đơn hàng
              </h1>
              <p className="mt-2 max-w-2xl text-[var(--muted)]">
                Xác nhận thông tin nhận hàng, khu vực phục vụ và lịch lắp đặt
                trước khi đặt hàng.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section aria-label="Thông tin checkout" className="py-8 sm:py-10">
        <Container>
          <CheckoutFlow
            cart={cart}
            customer={{ email: profile.email, name: profile.name }}
            initialAddresses={addresses.items}
          />
        </Container>
      </section>
    </main>
  );
}
