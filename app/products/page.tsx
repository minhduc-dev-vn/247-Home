import Link from 'next/link';
import { ProductCategory } from '@prisma/client';

import { ServiceAreaChecker } from '@/components/catalog/service-area-checker';
import { listPublicProducts, productListQuerySchema } from '@/modules/catalog';
import { formatVnd } from '@/shared/money/format-vnd';

export const dynamic = 'force-dynamic';

const categoryLabels: Record<ProductCategory, string> = {
  SECURITY_CAMERA: 'Camera an ninh',
  VIDEO_DOORBELL: 'Chuong cua co hinh',
  MESH_WIFI: 'Wi-Fi mesh',
  SMART_LOCK: 'Khoa cua thong minh',
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = productListQuerySchema.parse({
    category: typeof raw.category === 'string' ? raw.category : undefined,
    q: typeof raw.q === 'string' ? raw.q : undefined,
    minPrice: typeof raw.minPrice === 'string' ? raw.minPrice : undefined,
    maxPrice: typeof raw.maxPrice === 'string' ? raw.maxPrice : undefined,
    cursor: typeof raw.cursor === 'string' ? raw.cursor : undefined,
    limit: typeof raw.limit === 'string' ? raw.limit : undefined,
  });
  const catalog = await listPublicProducts(query);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 sm:px-10">
      <header className="flex flex-wrap items-center gap-4 border-b pb-6">
        <Link className="font-semibold text-[var(--primary)]" href="/">
          247 Home
        </Link>
        <h1 className="text-2xl font-semibold">San pham</h1>
        <Link className="ml-auto text-sm font-medium" href="/account">
          Tai khoan
        </Link>
      </header>
      <form
        className="mt-8 grid gap-3 border-b pb-6 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"
        method="get"
      >
        <input
          className="h-10 border bg-white px-3"
          defaultValue={query.q}
          name="q"
          placeholder="Tim san pham"
        />
        <select
          className="h-10 border bg-white px-3"
          defaultValue={query.category ?? ''}
          name="category"
        >
          <option value="">Tat ca nhom</option>
          {Object.entries(categoryLabels).map(([category, label]) => (
            <option key={category} value={category}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="h-10 border bg-white px-3"
          defaultValue={query.minPrice}
          inputMode="numeric"
          name="minPrice"
          placeholder="Gia tu"
        />
        <input
          className="h-10 border bg-white px-3"
          defaultValue={query.maxPrice}
          inputMode="numeric"
          name="maxPrice"
          placeholder="Gia den"
        />
        <button
          className="h-10 bg-[var(--primary)] px-4 font-medium text-white"
          type="submit"
        >
          Loc
        </button>
      </form>
      <section
        aria-label="Danh sach san pham"
        className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {catalog.items.map((product) => (
          <article className="border bg-white p-5" key={product.id}>
            <p className="text-xs font-medium text-[var(--muted)]">
              {categoryLabels[product.category]}
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              <Link href={`/products/${product.slug}`}>{product.name}</Link>
            </h2>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
              {product.description}
            </p>
            <div className="mt-5 flex items-end justify-between gap-3">
              <p className="font-semibold">
                {product.minPriceVnd
                  ? formatVnd(product.minPriceVnd)
                  : 'Lien he'}
              </p>
              <span
                className={
                  product.availability === 'IN_STOCK'
                    ? 'text-sm text-emerald-700'
                    : 'text-sm text-red-700'
                }
              >
                {product.availability === 'IN_STOCK' ? 'Con hang' : 'Het hang'}
              </span>
            </div>
          </article>
        ))}
      </section>
      {catalog.items.length === 0 ? (
        <p className="mt-8 text-[var(--muted)]">Khong co san pham phu hop.</p>
      ) : null}
      {catalog.nextCursor ? (
        <Link
          className="mt-8 inline-block border bg-white px-4 py-2 text-sm font-medium"
          href={{
            pathname: '/products',
            query: { ...raw, cursor: catalog.nextCursor },
          }}
        >
          Xem them
        </Link>
      ) : null}
      <div className="mt-12">
        <ServiceAreaChecker />
      </div>
    </main>
  );
}
