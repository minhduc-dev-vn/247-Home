'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Variant = {
  id: string;
  name: string;
  availability: string;
  servicePackages: { id: string; name: string }[];
};

export function AddToCart({ variants }: { variants: Variant[] }) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
  const [packageId, setPackageId] = useState('');
  const [pending, setPending] = useState(false);
  const selected = variants.find((variant) => variant.id === variantId);
  async function submit() {
    setPending(true);
    const response = await fetch('/api/v1/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productVariantId: variantId,
        servicePackageId: packageId || null,
        quantity: 1,
      }),
    });
    if (response.ok) router.push('/cart');
    setPending(false);
  }
  return (
    <section className="mt-8 border p-5">
      <h2 className="text-lg font-semibold">Them vao gio</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          aria-label="Bien the"
          className="h-10 border bg-white px-3"
          value={variantId}
          onChange={(event) => {
            setVariantId(event.target.value);
            setPackageId('');
          }}
        >
          {variants.map((variant) => (
            <option
              disabled={variant.availability !== 'IN_STOCK'}
              key={variant.id}
              value={variant.id}
            >
              {variant.name} -{' '}
              {variant.availability === 'IN_STOCK' ? 'Con hang' : 'Het hang'}
            </option>
          ))}
        </select>
        <select
          aria-label="Goi lap dat"
          className="h-10 border bg-white px-3"
          value={packageId}
          onChange={(event) => setPackageId(event.target.value)}
        >
          <option value="">Khong chon goi lap dat</option>
          {selected?.servicePackages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <button
        className="mt-4 h-10 bg-[var(--primary)] px-4 font-medium text-white disabled:opacity-60"
        disabled={!variantId || pending}
        onClick={submit}
        type="button"
      >
        {pending ? 'Dang them' : 'Them vao gio'}
      </button>
    </section>
  );
}
