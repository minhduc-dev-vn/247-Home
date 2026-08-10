'use client';

import Image from 'next/image';
import { useState } from 'react';

import { categoryPresentation } from '@/components/catalog/category-presentation';
import { getProductDemoImages } from '@/components/catalog/product-demo-images';
import { cn } from '@/lib/utils';

type ProductImage = { altText: string; id: string };

export function ProductGallery({
  category,
  images,
  productName,
  productSlug,
}: {
  category: keyof typeof categoryPresentation;
  images: ProductImage[];
  productName: string;
  productSlug: string;
}) {
  const gallery =
    images.length > 0
      ? images.map((image) => ({
          altText: image.altText,
          id: image.id,
          isDemo: false,
          src: `/api/v1/product-images/${image.id}`,
        }))
      : getProductDemoImages(productSlug).map((image) => ({
          ...image,
          id: image.src,
          isDemo: true,
        }));
  const [selectedId, setSelectedId] = useState(gallery[0]?.id ?? null);
  const selectedImage =
    gallery.find((image) => image.id === selectedId) ?? gallery[0] ?? null;
  const presentation = categoryPresentation[category];
  const CategoryIcon = presentation.icon;

  return (
    <div aria-label={`Hình ảnh ${productName}`}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-[var(--surface-subtle)]">
        {selectedImage ? (
          <Image
            alt={selectedImage.altText}
            className={cn(
              'motion-gallery-image absolute inset-0 h-full w-full',
              selectedImage.isDemo ? 'object-contain' : 'object-cover',
            )}
            height={900}
            priority
            sizes="(max-width: 1023px) 100vw, 50vw"
            src={selectedImage.src}
            width={1200}
            key={selectedImage.id}
          />
        ) : (
          <div
            aria-label={`Minh họa ${presentation.label} cho ${productName}`}
            className="absolute inset-0 grid place-items-center"
            role="img"
          >
            <div className="grid size-28 place-items-center rounded-lg border bg-[var(--surface)] text-[var(--primary)] shadow-sm">
              <CategoryIcon aria-hidden="true" className="size-14" />
            </div>
            <span className="absolute right-4 bottom-4 text-sm font-medium text-[var(--muted)]">
              {presentation.label}
            </span>
          </div>
        )}
      </div>

      {gallery.length > 1 ? (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {gallery.map((image) => (
            <button
              aria-label={`Xem ${image.altText}`}
              aria-pressed={image.id === selectedImage?.id}
              className={cn(
                'relative aspect-square w-20 shrink-0 overflow-hidden rounded-md border-2 bg-[var(--surface)] transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.97] motion-reduce:transform-none',
                image.id === selectedImage?.id
                  ? 'border-[var(--primary)]'
                  : 'border-transparent',
              )}
              key={image.id}
              onClick={() => setSelectedId(image.id)}
              type="button"
            >
              <Image
                alt=""
                className={cn(
                  'absolute inset-0 h-full w-full',
                  image.isDemo ? 'object-contain' : 'object-cover',
                )}
                height={160}
                src={image.src}
                width={160}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
