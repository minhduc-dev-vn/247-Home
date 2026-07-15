import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getPublicProduct } from '@/modules/catalog';
import { AddToCart } from '@/components/commerce/add-to-cart';
import { formatVnd } from '@/shared/money/format-vnd';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const product = await getPublicProduct((await params).slug);
  if (!product) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10 sm:px-10">
      <Link
        className="text-sm font-medium text-[var(--primary)]"
        href="/products"
      >
        San pham
      </Link>
      <p className="mt-8 text-sm text-[var(--muted)]">{product.category}</p>
      <h1 className="mt-2 text-3xl font-semibold">{product.name}</h1>
      <p className="mt-5 max-w-3xl leading-7 text-[var(--muted)]">
        {product.description}
      </p>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Bien the va ton kho</h2>
        <div className="mt-4 divide-y border bg-white">
          {product.variants.map((variant) => (
            <div className="p-5" key={variant.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">{variant.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    SKU {variant.sku}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatVnd(variant.priceVnd)}</p>
                  <p
                    className={
                      variant.availability === 'IN_STOCK'
                        ? 'mt-1 text-sm text-emerald-700'
                        : 'mt-1 text-sm text-red-700'
                    }
                  >
                    {variant.availability === 'IN_STOCK'
                      ? 'Con hang'
                      : 'Het hang'}
                  </p>
                </div>
              </div>
              {variant.servicePackages.length ? (
                <ul className="mt-4 grid gap-2 border-t pt-4 text-sm">
                  {variant.servicePackages.map((servicePackage) => (
                    <li
                      className="flex flex-wrap justify-between gap-2"
                      key={servicePackage.id}
                    >
                      <span>
                        {servicePackage.name}: {servicePackage.description}
                      </span>
                      <strong>{formatVnd(servicePackage.priceVnd)}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <AddToCart
        variants={product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          availability: variant.availability,
          servicePackages: variant.servicePackages.map((item) => ({
            id: item.id,
            name: item.name,
          })),
        }))}
      />
    </main>
  );
}
