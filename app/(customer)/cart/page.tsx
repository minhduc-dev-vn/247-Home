import { ShoppingCart } from 'lucide-react';

import { CartView } from '@/components/commerce/cart-view';
import { Container } from '@/components/layout/container';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { getCart } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const cart = await getCart(await requirePageActor());

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container>
          <Breadcrumb
            items={[{ href: '/', label: 'Trang chủ' }, { label: 'Giỏ hàng' }]}
          />
          <div className="mt-7 flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <ShoppingCart aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">Giỏ hàng</h1>
              <p className="mt-2 text-[var(--muted)]">
                Kiểm tra thiết bị, số lượng và dịch vụ lắp đặt trước khi
                checkout.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-10" aria-label="Nội dung giỏ hàng">
        <Container>
          <CartView initialCart={cart} />
        </Container>
      </section>
    </main>
  );
}
