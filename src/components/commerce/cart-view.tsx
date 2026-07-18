'use client';

import { ArrowRight, PackageOpen, ShieldCheck, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { CartItem, type CartLine } from '@/components/commerce/cart-item';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatVnd } from '@/shared/money/format-vnd';

type Cart = {
  id: string;
  items: CartLine[];
  status: string;
  version: number;
};

async function cartResponse(response: Response): Promise<Cart> {
  const payload = (await response.json()) as {
    data?: Cart;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !payload.data) {
    if (response.status === 429)
      throw new Error('Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
    if (payload.error?.code === 'CONFLICT')
      throw new Error('Giỏ hàng vừa thay đổi. Vui lòng tải lại trang.');
    throw new Error('Không thể cập nhật giỏ hàng. Vui lòng thử lại.');
  }
  return payload.data;
}

export function CartView({ initialCart }: { initialCart: Cart }) {
  const [cart, setCart] = useState(initialCart);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateQuantity(itemId: string, quantity: number) {
    setPendingItemId(itemId);
    setError(null);
    try {
      setCart(
        await cartResponse(
          await fetch(`/api/v1/cart/items/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity }),
          }),
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Không thể cập nhật số lượng.',
      );
    } finally {
      setPendingItemId(null);
    }
  }

  async function removeItem(itemId: string) {
    setPendingItemId(itemId);
    setError(null);
    try {
      setCart(
        await cartResponse(
          await fetch(`/api/v1/cart/items/${itemId}`, { method: 'DELETE' }),
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Không thể xóa sản phẩm.',
      );
    } finally {
      setPendingItemId(null);
    }
  }

  const deviceSubtotal = cart.items.reduce(
    (sum, item) => sum + BigInt(item.deviceUnitPrice) * BigInt(item.quantity),
    0n,
  );
  const installationSubtotal = cart.items.reduce(
    (sum, item) => sum + BigInt(item.serviceUnitPrice) * BigInt(item.quantity),
    0n,
  );
  const estimatedTotal = deviceSubtotal + installationSubtotal;
  const installationItems = cart.items.filter(
    (item) => item.servicePackageId !== null,
  );

  if (cart.items.length === 0) {
    return (
      <EmptyState
        action={
          <Link className={buttonVariants({ size: 'lg' })} href="/products">
            Khám phá sản phẩm
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
        className="min-h-[26rem] border border-dashed bg-[var(--surface)]"
        description="Thêm thiết bị và gói lắp đặt phù hợp để bắt đầu đơn hàng."
        icon={<PackageOpen aria-hidden="true" className="size-5" />}
        title="Giỏ hàng của bạn đang trống"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="min-w-0">
        {error ? (
          <Alert className="mb-4" title="Cập nhật thất bại" variant="error">
            {error}
          </Alert>
        ) : null}
        <div className="rounded-lg border bg-[var(--surface)] px-4 shadow-[var(--shadow-card)] sm:px-6">
          {cart.items.map((item) => (
            <CartItem
              item={item}
              key={item.id}
              onQuantityChange={(quantity) =>
                void updateQuantity(item.id, quantity)
              }
              onRemove={() => void removeItem(item.id)}
              pending={pendingItemId === item.id}
            />
          ))}
        </div>

        <section
          aria-labelledby="installation-summary-title"
          className="mt-6 border-y py-5"
        >
          <div className="flex items-center gap-2">
            <Wrench
              aria-hidden="true"
              className="size-5 text-[var(--primary)]"
            />
            <h2 className="font-bold" id="installation-summary-title">
              Dịch vụ lắp đặt trong giỏ
            </h2>
          </div>
          {installationItems.length > 0 ? (
            <ul className="mt-4 grid gap-3 text-sm">
              {installationItems.map((item) => (
                <li
                  className="flex flex-wrap justify-between gap-2"
                  key={item.id}
                >
                  <span>
                    <strong>{item.name}</strong>: {item.servicePackageName}
                  </span>
                  <span>
                    {formatVnd(
                      BigInt(item.serviceUnitPrice) * BigInt(item.quantity),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Các sản phẩm hiện tại không kèm dịch vụ lắp đặt.
            </p>
          )}
        </section>

        <Link
          className={buttonVariants({ className: 'mt-6', intent: 'secondary' })}
          href="/products"
        >
          Tiếp tục mua sắm
        </Link>
      </div>

      <Card className="lg:sticky lg:top-24" data-testid="cart-summary">
        <CardHeader>
          <h2 className="font-bold">Tóm tắt giỏ hàng</h2>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Thiết bị</dt>
              <dd className="font-medium">{formatVnd(deviceSubtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Gói lắp đặt</dt>
              <dd className="font-medium">{formatVnd(installationSubtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-4 text-base">
              <dt className="font-bold">Tạm tính</dt>
              <dd className="font-bold text-[var(--primary)]">
                {formatVnd(estimatedTotal)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
            Phí giao hàng và phí khu vực lắp đặt được server xác nhận tại bước
            checkout.
          </p>
          <Link
            className={buttonVariants({ className: 'mt-5 w-full', size: 'lg' })}
            href="/checkout"
          >
            Tiếp tục checkout
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            Giá, tồn kho và khả năng phục vụ sẽ được kiểm tra lại trước khi tạo
            đơn.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
