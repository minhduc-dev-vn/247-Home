'use client';

import { Minus, Package, Plus, Trash2, Wrench } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { formatVnd } from '@/shared/money/format-vnd';

export type CartLine = {
  availability: string;
  deviceUnitPrice: string;
  id: string;
  name: string;
  productVariantId: string;
  quantity: number;
  servicePackageId: string | null;
  servicePackageName: string | null;
  serviceUnitPrice: string;
};

export function CartItem({
  item,
  onQuantityChange,
  onRemove,
  pending,
}: {
  item: CartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  pending: boolean;
}) {
  const unitPrice =
    BigInt(item.deviceUnitPrice) + BigInt(item.serviceUnitPrice);
  const lineTotal = unitPrice * BigInt(item.quantity);

  return (
    <article
      aria-busy={pending || undefined}
      className="grid min-w-0 gap-4 border-b py-6 transition-[opacity,transform] duration-200 last:border-b-0 aria-busy:translate-x-1 aria-busy:opacity-60 motion-reduce:transform-none sm:grid-cols-[7rem_minmax(0,1fr)]"
      data-testid="cart-item"
    >
      <div
        aria-label={`Hình đại diện ${item.name}`}
        className="grid aspect-square w-28 place-items-center rounded-lg border bg-[var(--surface-subtle)] text-[var(--primary)] sm:w-full"
        role="img"
      >
        <Package aria-hidden="true" className="size-10" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge
              variant={item.availability === 'AVAILABLE' ? 'success' : 'error'}
            >
              {item.availability === 'AVAILABLE'
                ? 'Có thể đặt hàng'
                : 'Cần kiểm tra lại'}
            </Badge>
            <h2 className="mt-3 text-lg font-bold">{item.name}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Mã biến thể: {item.productVariantId}
            </p>
          </div>
          <p className="shrink-0 text-lg font-bold">{formatVnd(lineTotal)}</p>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md bg-[var(--surface-subtle)] px-3 py-3 text-sm">
          <Wrench
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-[var(--primary)]"
          />
          <div>
            <p className="font-semibold">
              {item.servicePackageName ?? 'Không có dịch vụ lắp đặt'}
            </p>
            {item.servicePackageName ? (
              <p className="mt-1 text-[var(--muted)]">
                {formatVnd(item.serviceUnitPrice)} / sản phẩm
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Số lượng</p>
            <div className="flex h-10 items-center rounded-md border bg-[var(--surface)]">
              <button
                aria-label={`Giảm số lượng ${item.name}`}
                className={buttonVariants({
                  className: 'rounded-r-none border-0',
                  intent: 'ghost',
                  size: 'icon',
                })}
                disabled={pending || item.quantity <= 1}
                onClick={() => onQuantityChange(item.quantity - 1)}
                type="button"
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <output
                aria-label={`Số lượng ${item.name}`}
                className="motion-quantity-change grid h-full min-w-10 place-items-center border-x px-3 text-sm font-semibold"
                data-testid="cart-item-quantity"
                key={item.quantity}
              >
                {item.quantity}
              </output>
              <button
                aria-label={`Tăng số lượng ${item.name}`}
                className={buttonVariants({
                  className: 'rounded-l-none border-0',
                  intent: 'ghost',
                  size: 'icon',
                })}
                disabled={pending || item.quantity >= 99}
                onClick={() => onQuantityChange(item.quantity + 1)}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-[var(--muted)]">
              Đơn giá: {formatVnd(unitPrice)}
            </p>
            <button
              className={buttonVariants({
                className: 'mt-2 text-[var(--error)]',
                intent: 'ghost',
                size: 'sm',
              })}
              disabled={pending}
              onClick={onRemove}
              type="button"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Xóa
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
