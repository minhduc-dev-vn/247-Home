import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  ClipboardCheck,
  Headphones,
  HousePlug,
  PackageCheck,
  Refrigerator,
  ShieldCheck,
  Snowflake,
  Tv,
  WashingMachine,
  Wrench,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import smartHomeEntryway from '../../public/images/smart-home-entryway.png';

import { ProductCard } from '@/components/catalog/product-card';
import { Container } from '@/components/layout/container';
import { Reveal } from '@/components/motion/reveal';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getPublicProduct,
  listPublicProducts,
  productListQuerySchema,
} from '@/modules/catalog';

export const dynamic = 'force-dynamic';

const categories = [
  { icon: Snowflake, label: 'Điều hòa' },
  { icon: WashingMachine, label: 'Máy giặt' },
  { icon: Refrigerator, label: 'Tủ lạnh' },
  { icon: Tv, label: 'TV' },
  { icon: HousePlug, label: 'Smart Home' },
];

const installationSteps = [
  {
    description: 'So sánh biến thể, giá và tình trạng còn hàng.',
    icon: PackageCheck,
    title: 'Chọn thiết bị',
  },
  {
    description: 'Kiểm tra khu vực và chọn ngày, khung giờ phù hợp.',
    icon: CalendarCheck2,
    title: 'Đặt lịch lắp đặt',
  },
  {
    description: 'Theo dõi kỹ thuật viên và tiến độ ngay trong tài khoản.',
    icon: Wrench,
    title: 'Kỹ thuật viên xử lý',
  },
  {
    description: 'Lưu lịch sử nghiệm thu để hỗ trợ sau bán hàng.',
    icon: ShieldCheck,
    title: 'Bảo hành',
  },
];

const trustItems = [
  {
    description: 'Thông tin sản phẩm, biến thể và giá được công khai rõ ràng.',
    icon: BadgeCheck,
    title: 'Thiết bị chính hãng',
  },
  {
    description: 'Công việc được phân công cho kỹ thuật viên theo khu vực.',
    icon: Wrench,
    title: 'Kỹ thuật viên phù hợp',
  },
  {
    description: 'Đơn hàng và lịch lắp đặt có trạng thái cập nhật xuyên suốt.',
    icon: ClipboardCheck,
    title: 'Theo dõi tiến độ',
  },
  {
    description: 'Thông tin đơn và lắp đặt luôn sẵn sàng khi cần hỗ trợ.',
    icon: Headphones,
    title: 'Hậu mãi liền mạch',
  },
];

async function getFeaturedProducts() {
  const catalog = await listPublicProducts(
    productListQuerySchema.parse({ limit: 4 }),
  );
  return Promise.all(
    catalog.items.map(async (product) => {
      const detail = await getPublicProduct(product.slug);
      const installationAvailable =
        detail?.variants.some(
          (variant) => variant.servicePackages.length > 0,
        ) ?? false;
      return { ...product, installationAvailable };
    }),
  );
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <main>
      <section
        className="relative overflow-hidden border-b bg-[var(--surface)]"
        data-testid="customer-hero"
      >
        <div
          className="absolute inset-y-0 right-0 hidden w-[54%] overflow-hidden lg:block"
          data-testid="customer-hero-image-desktop"
        >
          <Image
            alt="Không gian căn hộ với camera, chuông cửa, khóa thông minh và bộ phát Wi-Fi"
            className="motion-hero-image absolute inset-0 h-full w-full object-cover object-[70%_center]"
            priority
            sizes="54vw"
            src={smartHomeEntryway}
            unoptimized
          />
        </div>

        <Container className="relative z-10 lg:grid lg:h-[640px] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
          <div className="py-10 sm:py-12 lg:py-0 lg:pr-12">
            <p className="motion-hero-item inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)] [--motion-delay:120ms]">
              <BadgeCheck aria-hidden="true" className="size-5" />
              Mua thiết bị và đặt lịch trong một quy trình
            </p>
            <h1 className="motion-hero-item mt-4 text-4xl leading-tight font-bold [--motion-delay:240ms] sm:text-5xl">
              <span className="block">Thiết bị chính hãng.</span>
              <span className="block">Lắp đặt tận nơi.</span>
              <span className="block">Hỗ trợ sau bán hàng.</span>
            </h1>
            <p className="motion-hero-item mt-5 max-w-xl text-base leading-7 text-[var(--muted-foreground)] [--motion-delay:400ms] sm:text-lg">
              Khám phá thiết bị phù hợp cho ngôi nhà, kiểm tra khu vực phục vụ
              và theo dõi toàn bộ tiến độ lắp đặt trên 247 Home.
            </p>
            <div className="motion-hero-item mt-7 [--motion-delay:560ms]">
              <Link
                className={buttonVariants({ intent: 'accent', size: 'lg' })}
                href="/products"
              >
                Khám phá sản phẩm
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
        </Container>

        <div
          className="relative aspect-[16/10] overflow-hidden border-t lg:hidden"
          data-testid="customer-hero-image-mobile"
        >
          <Image
            alt="Không gian căn hộ với camera, chuông cửa, khóa thông minh và bộ phát Wi-Fi"
            className="motion-hero-image absolute inset-0 h-full w-full object-cover object-[70%_center]"
            priority
            sizes="100vw"
            src={smartHomeEntryway}
            unoptimized
          />
        </div>
      </section>

      <section aria-labelledby="category-title" className="py-12 sm:py-16">
        <Reveal>
          <Container>
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-[var(--primary)]">
                Danh mục sản phẩm
              </p>
              <h2
                className="mt-2 text-2xl font-bold sm:text-3xl"
                id="category-title"
              >
                Thiết bị thiết yếu cho mọi không gian sống
              </h2>
              <p className="mt-3 leading-7 text-[var(--muted)]">
                Bắt đầu từ nhu cầu của gia đình và tìm thiết bị phù hợp trong
                catalog 247 Home.
              </p>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categories.map(({ icon: Icon, label }, index) => (
                <Reveal className="h-full" delay={index * 55} key={label}>
                  <Card className="motion-card-interactive h-full">
                    <CardContent className="flex h-full min-h-36 flex-col justify-between p-4 sm:p-5">
                      <div className="grid size-10 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                        <Icon aria-hidden="true" className="size-5" />
                      </div>
                      <h3 className="mt-5 font-bold">{label}</h3>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </Container>
        </Reveal>
      </section>

      <section
        aria-labelledby="featured-products-title"
        className="border-y bg-[var(--surface)] py-12 sm:py-16"
      >
        <Reveal>
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--primary)]">
                  Đang có tại 247 Home
                </p>
                <h2
                  className="mt-2 text-2xl font-bold sm:text-3xl"
                  id="featured-products-title"
                >
                  Sản phẩm nổi bật
                </h2>
              </div>
              <Link
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
                href="/products"
              >
                Xem toàn bộ sản phẩm
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            {featuredProducts.length > 0 ? (
              <div
                aria-label="Sản phẩm nổi bật"
                className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
              >
                {featuredProducts.map((product, index) => (
                  <Reveal
                    className="h-full"
                    delay={index * 65}
                    key={product.id}
                  >
                    <ProductCard product={product} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <Card className="mt-7 border-dashed shadow-none">
                <CardContent className="py-10 text-center">
                  <p className="font-semibold">Catalog đang được cập nhật.</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Vui lòng quay lại sau để xem sản phẩm mới.
                  </p>
                </CardContent>
              </Card>
            )}
          </Container>
        </Reveal>
      </section>

      <section
        aria-labelledby="installation-title"
        className="scroll-mt-28 py-12 sm:py-16"
        id="installation"
      >
        <Reveal>
          <Container>
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-[var(--primary)]">
                Dịch vụ lắp đặt
              </p>
              <h2
                className="mt-2 text-2xl font-bold sm:text-3xl"
                id="installation-title"
              >
                Từ chọn mua đến nghiệm thu trong bốn bước
              </h2>
            </div>
            <ol className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {installationSteps.map(
                ({ description, icon: Icon, title }, index) => (
                  <li key={title}>
                    <Reveal delay={index * 80}>
                      <div className="motion-service-step pt-5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-[var(--accent)]">
                            0{index + 1}
                          </span>
                          <Icon
                            aria-hidden="true"
                            className="size-5 text-[var(--primary)]"
                          />
                        </div>
                        <h3 className="mt-5 text-lg font-bold">{title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {description}
                        </p>
                      </div>
                    </Reveal>
                  </li>
                ),
              )}
            </ol>
          </Container>
        </Reveal>
      </section>

      <section
        aria-labelledby="trust-title"
        className="scroll-mt-28 border-y bg-[var(--foreground)] py-12 text-white sm:py-16"
        id="support"
      >
        <Reveal>
          <Container>
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-[var(--primary-soft)]">
                Đồng hành sau khi mua
              </p>
              <h2
                className="mt-2 text-2xl font-bold sm:text-3xl"
                id="trust-title"
              >
                An tâm trong từng bước vận hành
              </h2>
            </div>
            <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {trustItems.map(({ description, icon: Icon, title }, index) => (
                <Reveal delay={index * 60} key={title}>
                  <article>
                    <Icon
                      aria-hidden="true"
                      className="size-6 text-[var(--accent)]"
                    />
                    <h3 className="mt-4 font-bold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      {description}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </Container>
        </Reveal>
      </section>
    </main>
  );
}
