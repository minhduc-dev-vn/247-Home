'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatVnd } from '@/shared/money/format-vnd';

type Variant = {
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
  id: string;
  name: string;
  priceVnd: string;
  servicePackages: { id: string; name: string; priceVnd: string }[];
};

export function AddToCart({ variants }: { variants: Variant[] }) {
  const router = useRouter();
  const firstAvailable = variants.find(
    (variant) => variant.availability === 'IN_STOCK',
  );
  const [variantId, setVariantId] = useState(
    firstAvailable?.id ?? variants[0]?.id ?? '',
  );
  const [packageId, setPackageId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = variants.find((variant) => variant.id === variantId);
  const selectedPackage = selected?.servicePackages.find(
    (servicePackage) => servicePackage.id === packageId,
  );
  const parsedQuantity = Number(quantity);
  const canSubmit =
    Boolean(selected) &&
    selected?.availability === 'IN_STOCK' &&
    Number.isInteger(parsedQuantity) &&
    parsedQuantity >= 1 &&
    parsedQuantity <= 99;

  async function submit() {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productVariantId: variantId,
          servicePackageId: packageId || null,
          quantity: parsedQuantity,
        }),
      });
      if (response.status === 401) {
        setError(
          'Vui lòng đăng nhập bằng tài khoản khách hàng để thêm sản phẩm.',
        );
        return;
      }
      if (!response.ok) {
        setError(
          'Không thể thêm sản phẩm vào giỏ. Vui lòng kiểm tra lựa chọn.',
        );
        return;
      }
      router.push('/cart');
      router.refresh();
    } catch {
      setError('Không thể kết nối tới giỏ hàng. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="purchase-options-title"
      className="mt-6 rounded-lg border bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold" id="purchase-options-title">
          Lựa chọn mua hàng
        </h2>
        {selected ? (
          <p className="font-bold">{formatVnd(selected.priceVnd)}</p>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="variant-id"
          >
            Biến thể
          </label>
          <Select
            id="variant-id"
            value={variantId}
            onChange={(event) => {
              setVariantId(event.target.value);
              setPackageId('');
              setError(null);
            }}
          >
            {variants.map((variant) => (
              <option
                disabled={variant.availability !== 'IN_STOCK'}
                key={variant.id}
                value={variant.id}
              >
                {variant.name} -{' '}
                {variant.availability === 'IN_STOCK' ? 'Còn hàng' : 'Hết hàng'}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="quantity"
          >
            Số lượng
          </label>
          <Input
            id="quantity"
            inputMode="numeric"
            max={99}
            min={1}
            onChange={(event) => setQuantity(event.currentTarget.value)}
            type="number"
            value={quantity}
          />
        </div>
      </div>
      <div className="mt-4">
        <label
          className="mb-2 block text-sm font-semibold"
          htmlFor="service-package-id"
        >
          Gói lắp đặt
        </label>
        <Select
          id="service-package-id"
          value={packageId}
          onChange={(event) => {
            setPackageId(event.target.value);
            setError(null);
          }}
        >
          <option value="">Không chọn gói lắp đặt</option>
          {selected?.servicePackages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} - {formatVnd(item.priceVnd)}
            </option>
          ))}
        </Select>
        {selectedPackage ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Phí gói đã chọn: {formatVnd(selectedPackage.priceVnd)}
          </p>
        ) : null}
      </div>
      <Button
        className="mt-5 w-full"
        disabled={!canSubmit}
        loading={pending}
        onClick={submit}
        size="lg"
        type="button"
      >
        <ShoppingCart aria-hidden="true" className="size-4" />
        Thêm vào giỏ hàng
      </Button>
      {error ? (
        <Alert className="mt-4" title="Chưa thể thêm vào giỏ" variant="error">
          {error}{' '}
          {error.startsWith('Vui lòng đăng nhập') ? (
            <Link className="font-semibold underline" href="/login">
              Đăng nhập
            </Link>
          ) : null}
        </Alert>
      ) : null}
    </section>
  );
}
