import { ArrowRight, PackageCheck, ShieldCheck, Wrench } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { categoryPresentation } from '@/components/catalog/category-presentation';
import { getProductPrimaryDemoImage } from '@/components/catalog/product-demo-images';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatVnd } from '@/shared/money/format-vnd';

type CatalogProduct = {
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
  category: keyof typeof categoryPresentation;
  description: string;
  id: string;
  image: { altText: string; id: string } | null;
  installationAvailable: boolean;
  minPriceVnd: string | null;
  name: string;
  slug: string;
};

export function ProductCard({ product }: { product: CatalogProduct }) {
  const presentation = categoryPresentation[product.category];
  const CategoryIcon = presentation.icon;
  const image = product.image
    ? {
        altText: product.image.altText,
        src: `/api/v1/product-images/${product.image.id}`,
      }
    : getProductPrimaryDemoImage(product.slug);

  return (
    <Card
      className="motion-card-interactive group flex h-full min-w-0 flex-col overflow-hidden"
      data-testid="featured-product-card"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-subtle)]">
        {image ? (
          <Image
            alt={image.altText}
            className={cn(
              'absolute inset-0 h-full w-full transition-transform duration-300 group-hover:scale-[1.03]',
              product.image ? 'object-cover' : 'object-contain',
            )}
            height={600}
            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
            src={image.src}
            width={800}
          />
        ) : (
          <div
            aria-label={`Minh họa ${presentation.label}`}
            className="absolute inset-0 grid place-items-center"
            role="img"
          >
            <div className="grid size-20 place-items-center rounded-lg border bg-[var(--surface)] text-[var(--primary)] shadow-sm">
              <CategoryIcon aria-hidden="true" className="size-10" />
            </div>
            <span className="absolute right-3 bottom-3 text-xs font-medium text-[var(--muted)]">
              {presentation.label}
            </span>
          </div>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge>{presentation.label}</Badge>
          <Badge
            variant={product.availability === 'IN_STOCK' ? 'success' : 'error'}
          >
            {product.availability === 'IN_STOCK' ? 'Còn hàng' : 'Hết hàng'}
          </Badge>
        </div>
        <h3 className="mt-4 line-clamp-2 text-lg font-bold">
          <Link
            className="hover:text-[var(--primary)]"
            href={`/products/${product.slug}`}
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
          {product.description}
        </p>
        <p className="mt-4 text-lg font-bold">
          {product.minPriceVnd
            ? `Từ ${formatVnd(product.minPriceVnd)}`
            : 'Liên hệ'}
        </p>
        <div className="mt-3 space-y-2 text-sm text-[var(--muted-foreground)]">
          <p className="flex items-center gap-2">
            {product.installationAvailable ? (
              <Wrench
                aria-hidden="true"
                className="size-4 text-[var(--primary)]"
              />
            ) : (
              <PackageCheck aria-hidden="true" className="size-4" />
            )}
            {product.installationAvailable
              ? 'Có gói lắp đặt'
              : 'Chưa có gói lắp đặt'}
          </p>
          <p className="flex items-center gap-2">
            <ShieldCheck
              aria-hidden="true"
              className="size-4 text-[var(--success)]"
            />
            Hỗ trợ yêu cầu bảo hành
          </p>
        </div>
        <Link
          aria-label={`Xem chi tiết ${product.name}`}
          className={buttonVariants({
            className: 'mt-5 w-full',
            intent: 'secondary',
          })}
          href={`/products/${product.slug}`}
        >
          Xem chi tiết
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
