import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Headphones,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { categoryPresentation } from '@/components/catalog/category-presentation';
import { ProductCard } from '@/components/catalog/product-card';
import { ProductGallery } from '@/components/catalog/product-gallery';
import { ServiceAreaChecker } from '@/components/catalog/service-area-checker';
import { AddToCart } from '@/components/commerce/add-to-cart';
import { Container } from '@/components/layout/container';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  getPublicProduct,
  listPublicProducts,
  productListQuerySchema,
} from '@/modules/catalog';
import { formatVnd } from '@/shared/money/format-vnd';

export const dynamic = 'force-dynamic';

async function getRelatedProducts(
  category: keyof typeof categoryPresentation,
  currentSlug: string,
) {
  const catalog = await listPublicProducts(
    productListQuerySchema.parse({ category, limit: 4 }),
  );
  return Promise.all(
    catalog.items
      .filter((product) => product.slug !== currentSlug)
      .slice(0, 3)
      .map(async (product) => {
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
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(product.category, slug);
  const presentation = categoryPresentation[product.category];
  const installationPackages = product.variants.flatMap((variant) =>
    variant.servicePackages.map((servicePackage) => ({
      ...servicePackage,
      variantName: variant.name,
    })),
  );
  const installationAvailable = installationPackages.length > 0;

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-7 sm:py-10">
        <Container>
          <Breadcrumb
            items={[
              { href: '/', label: 'Trang chủ' },
              { href: '/products', label: 'Sản phẩm' },
              { label: product.name },
            ]}
          />

          <div className="mt-7 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)] lg:gap-12">
            <ProductGallery
              category={product.category}
              images={product.images}
              productName={product.name}
              productSlug={product.slug}
            />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{presentation.label}</Badge>
                <Badge
                  variant={
                    product.availability === 'IN_STOCK' ? 'success' : 'error'
                  }
                >
                  {product.availability === 'IN_STOCK'
                    ? 'Còn hàng'
                    : 'Hết hàng'}
                </Badge>
                {installationAvailable ? (
                  <Badge variant="info">Có dịch vụ lắp đặt</Badge>
                ) : null}
              </div>
              <h1 className="mt-4 text-3xl leading-tight font-bold sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-4 leading-7 text-[var(--muted-foreground)]">
                {product.description}
              </p>
              <div className="mt-6 border-y py-5">
                <p className="text-sm font-semibold text-[var(--muted)]">
                  Giá từ
                </p>
                <p className="mt-1 text-3xl font-bold text-[var(--primary)]">
                  {product.minPriceVnd
                    ? formatVnd(product.minPriceVnd)
                    : 'Liên hệ'}
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
                  {installationAvailable ? (
                    <Wrench aria-hidden="true" className="size-4" />
                  ) : (
                    <PackageCheck aria-hidden="true" className="size-4" />
                  )}
                  {installationAvailable
                    ? `${installationPackages.length} gói lắp đặt đang khả dụng`
                    : 'Chưa có gói lắp đặt cho sản phẩm này'}
                </p>
              </div>

              <AddToCart
                variants={product.variants.map((variant) => ({
                  id: variant.id,
                  name: variant.name,
                  priceVnd: variant.priceVnd,
                  availability: variant.availability,
                  servicePackages: variant.servicePackages.map((item) => ({
                    id: item.id,
                    name: item.name,
                    priceVnd: item.priceVnd,
                  })),
                }))}
              />

              <Link
                className={buttonVariants({
                  className: 'mt-3 w-full',
                  intent: 'secondary',
                  size: 'lg',
                })}
                href="#service-area-check"
              >
                <MapPin aria-hidden="true" className="size-4" />
                Kiểm tra khu vực lắp đặt
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="installation-packages-title"
        className="py-12 sm:py-16"
      >
        <Container>
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-[var(--primary)]">
              Dịch vụ theo thiết bị
            </p>
            <h2
              className="mt-2 text-2xl font-bold sm:text-3xl"
              id="installation-packages-title"
            >
              Lắp đặt cùng 247 Home
            </h2>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              Chọn gói tương thích với biến thể ngay khi thêm sản phẩm vào giỏ
              hàng.
            </p>
          </div>

          {installationPackages.length > 0 ? (
            <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {installationPackages.map((servicePackage) => (
                <article
                  className="rounded-lg border bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
                  key={servicePackage.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                      <Wrench aria-hidden="true" className="size-5" />
                    </div>
                    <Badge>{servicePackage.variantName}</Badge>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">
                    {servicePackage.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {servicePackage.description}
                  </p>
                  <p className="mt-4 font-bold">
                    {formatVnd(servicePackage.priceVnd)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-7 border-l-4 border-[var(--warning)] bg-[var(--warning-soft)] px-5 py-4">
              <p className="font-semibold">
                Chưa có gói lắp đặt đang hoạt động.
              </p>
              <p className="mt-1 text-sm">
                Bạn vẫn có thể mua thiết bị mà không chọn dịch vụ lắp đặt.
              </p>
            </div>
          )}
        </Container>
      </section>

      <section
        aria-labelledby="technical-information-title"
        className="border-y bg-[var(--surface)] py-12 sm:py-16"
      >
        <Container>
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="text-sm font-bold text-[var(--primary)]">
                Dữ liệu catalog
              </p>
              <h2
                className="mt-2 text-2xl font-bold sm:text-3xl"
                id="technical-information-title"
              >
                Thông số kỹ thuật
              </h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">
                Chỉ các thông tin đã được công bố trong catalog hiện tại được
                hiển thị.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-subtle)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Biến thể
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      SKU
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Nhóm
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Tình trạng
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {product.variants.map((variant) => (
                    <tr key={variant.id}>
                      <td className="px-4 py-3 font-medium">{variant.name}</td>
                      <td className="px-4 py-3">{variant.sku}</td>
                      <td className="px-4 py-3">{presentation.label}</td>
                      <td className="px-4 py-3">
                        {variant.availability === 'IN_STOCK'
                          ? 'Còn hàng'
                          : 'Hết hàng'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="after-sales-title"
        className="bg-[var(--foreground)] py-12 text-white sm:py-16"
      >
        <Container>
          <p className="text-sm font-bold text-[var(--primary-soft)]">
            Đồng hành sau khi mua
          </p>
          <h2
            className="mt-2 text-2xl font-bold sm:text-3xl"
            id="after-sales-title"
          >
            Chính sách sau mua
          </h2>
          <div className="mt-8 grid gap-7 md:grid-cols-3">
            {[
              {
                description:
                  'Gửi yêu cầu bảo hành gắn với đơn hàng khi cần hỗ trợ.',
                icon: ShieldCheck,
                title: 'Yêu cầu bảo hành',
              },
              {
                description:
                  'Lưu thông tin đơn và dịch vụ để đội ngũ hỗ trợ xử lý đúng ngữ cảnh.',
                icon: Headphones,
                title: 'Hỗ trợ kỹ thuật',
              },
              {
                description:
                  'Theo dõi trạng thái lịch lắp đặt trong tài khoản khách hàng.',
                icon: ClipboardCheck,
                title: 'Theo dõi lắp đặt',
              },
            ].map(({ description, icon: Icon, title }) => (
              <article className="border-t border-white/25 pt-5" key={title}>
                <Icon
                  aria-hidden="true"
                  className="size-6 text-[var(--accent)]"
                />
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section
        className="scroll-mt-24 border-b bg-[var(--surface)]"
        id="service-area-check"
      >
        <Container>
          <ServiceAreaChecker />
        </Container>
      </section>

      <section
        aria-labelledby="related-products-title"
        className="py-12 sm:py-16"
      >
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[var(--primary)]">
                Cùng nhóm sản phẩm
              </p>
              <h2
                className="mt-2 text-2xl font-bold sm:text-3xl"
                id="related-products-title"
              >
                Khám phá thêm sản phẩm
              </h2>
            </div>
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
              href={`/products?category=${product.category}`}
            >
              Xem toàn bộ {presentation.label}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          {relatedProducts.length > 0 ? (
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          ) : (
            <div className="mt-7 flex items-center gap-3 border-y py-5 text-[var(--muted)]">
              <BadgeCheck aria-hidden="true" className="size-5" />
              <p>Catalog chưa có thêm sản phẩm trong nhóm này.</p>
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
