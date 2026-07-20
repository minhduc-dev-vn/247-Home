import { PackageSearch } from 'lucide-react';
import Link from 'next/link';
import { ProductCategory } from '@prisma/client';

import {
  categoryPresentation,
  productCategories,
} from '@/components/catalog/category-presentation';
import { ProductCard } from '@/components/catalog/product-card';
import { ProductFilters } from '@/components/catalog/product-filters';
import { ServiceAreaChecker } from '@/components/catalog/service-area-checker';
import { Container } from '@/components/layout/container';
import { Reveal } from '@/components/motion/reveal';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Pagination } from '@/components/navigation/pagination';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getPublicProduct,
  listPublicProducts,
  productListQuerySchema,
} from '@/modules/catalog';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type CatalogQuery = {
  category?: ProductCategory;
  cursor?: string;
  limit: number;
  maxPrice?: string;
  minPrice?: string;
  q?: string;
};

function optionalValue(value: string | string[] | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function catalogHref(
  query: CatalogQuery,
  changes: Partial<Omit<CatalogQuery, 'limit'>>,
) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.category) params.set('category', next.category);
  if (next.q) params.set('q', next.q);
  if (next.minPrice) params.set('minPrice', next.minPrice);
  if (next.maxPrice) params.set('maxPrice', next.maxPrice);
  if (next.cursor) params.set('cursor', next.cursor);
  if (next.limit !== 12) params.set('limit', String(next.limit));
  const queryString = params.toString();
  return queryString ? `/products?${queryString}` : '/products';
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsedQuery = productListQuerySchema.safeParse({
    category: optionalValue(raw.category),
    q: optionalValue(raw.q),
    minPrice: optionalValue(raw.minPrice),
    maxPrice: optionalValue(raw.maxPrice),
    cursor: optionalValue(raw.cursor),
    limit: optionalValue(raw.limit),
  });
  const query = parsedQuery.success
    ? parsedQuery.data
    : productListQuerySchema.parse({});
  const catalog = await listPublicProducts(query);
  const products = await Promise.all(
    catalog.items.map(async (product) => {
      const detail = await getPublicProduct(product.slug);
      return {
        ...product,
        installationAvailable:
          detail?.variants.some(
            (variant) => variant.servicePackages.length > 0,
          ) ?? false,
      };
    }),
  );
  const activeCategory = query.category
    ? categoryPresentation[query.category].label
    : 'Tất cả sản phẩm';

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container>
          <Breadcrumb
            items={[{ href: '/', label: 'Trang chủ' }, { label: 'Sản phẩm' }]}
          />
          <Reveal className="mt-7 max-w-3xl">
            <p className="text-sm font-bold text-[var(--primary)]">
              Catalog 247 Home
            </p>
            <h1 className="mt-2 text-3xl leading-tight font-bold sm:text-4xl">
              Thiết bị gia dụng chính hãng
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[var(--muted-foreground)]">
              Tìm kiếm thiết bị phù hợp cho ngôi nhà của bạn cùng dịch vụ lắp
              đặt chuyên nghiệp từ 247 Home.
            </p>
          </Reveal>
        </Container>
      </section>

      <section
        aria-label="Nhóm sản phẩm"
        className="border-b bg-[var(--surface)]"
      >
        <Container className="overflow-x-auto">
          <nav
            className="flex min-w-max gap-1 py-3"
            aria-label="Danh mục sản phẩm"
          >
            <Link
              aria-current={!query.category ? 'page' : undefined}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-semibold transition-colors',
                !query.category
                  ? 'bg-[var(--primary)] text-white'
                  : 'hover:bg-[var(--secondary)]',
              )}
              href={catalogHref(query, {
                category: undefined,
                cursor: undefined,
              })}
            >
              Tất cả
            </Link>
            {productCategories.map(([category, presentation]) => (
              <Link
                aria-current={query.category === category ? 'page' : undefined}
                className={cn(
                  'rounded-md px-4 py-2 text-sm font-semibold transition-colors',
                  query.category === category
                    ? 'bg-[var(--primary)] text-white'
                    : 'hover:bg-[var(--secondary)]',
                )}
                href={catalogHref(query, { category, cursor: undefined })}
                key={category}
              >
                {presentation.label}
              </Link>
            ))}
          </nav>
        </Container>
      </section>

      <section
        className="py-8 sm:py-10"
        aria-labelledby="catalog-results-title"
      >
        <Container>
          {!parsedQuery.success ? (
            <div
              className="mb-6 border-l-4 border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-sm"
              role="alert"
            >
              Bộ lọc không hợp lệ đã được bỏ qua. Vui lòng nhập lại khoảng giá
              hoặc từ khóa.
            </div>
          ) : null}

          <div className="mt-7 grid min-w-0 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <ProductFilters values={query} />
            <div className="min-w-0">
              <div className="flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold" id="catalog-results-title">
                    {activeCategory}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]" role="status">
                    {catalog.nextCursor
                      ? `Đang hiển thị ${products.length} sản phẩm trên trang này`
                      : `${products.length} sản phẩm`}
                  </p>
                </div>
                {query.q ? (
                  <p className="text-sm text-[var(--muted)]">
                    Kết quả cho: <strong>{query.q}</strong>
                  </p>
                ) : null}
              </div>

              {products.length > 0 ? (
                <div
                  aria-label="Danh sách sản phẩm"
                  className="mt-6 grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {products.map((product, index) => (
                    <article data-testid="product-card" key={product.id}>
                      <Reveal className="h-full" delay={index * 55}>
                        <ProductCard product={product} />
                      </Reveal>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  action={
                    <Link
                      className={buttonVariants({ intent: 'secondary' })}
                      href="/products"
                    >
                      Xem tất cả sản phẩm
                    </Link>
                  }
                  className="mt-6 border border-dashed bg-[var(--surface)]"
                  description="Thử thay đổi nhóm sản phẩm, từ khóa hoặc khoảng giá."
                  icon={<PackageSearch aria-hidden="true" className="size-5" />}
                  title="Không tìm thấy sản phẩm phù hợp"
                />
              )}

              <div className="mt-8 border-t pt-6">
                <Pagination
                  label={activeCategory}
                  nextHref={
                    catalog.nextCursor
                      ? catalogHref(query, { cursor: catalog.nextCursor })
                      : undefined
                  }
                />
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t bg-[var(--surface)]">
        <Container>
          <Reveal>
            <ServiceAreaChecker />
          </Reveal>
        </Container>
      </section>
    </main>
  );
}
