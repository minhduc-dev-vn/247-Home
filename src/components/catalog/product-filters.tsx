'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { ProductCategory } from '@prisma/client';
import { useEffect, useRef, useState } from 'react';

import { productCategories } from '@/components/catalog/category-presentation';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

type FilterValues = {
  category?: ProductCategory;
  maxPrice?: string;
  minPrice?: string;
  q?: string;
};

function FilterFields({
  idPrefix,
  values,
}: {
  idPrefix: string;
  values: FilterValues;
}) {
  return (
    <>
      <div>
        <label
          className="mb-2 block text-sm font-semibold"
          htmlFor={`${idPrefix}-catalog-q`}
        >
          Tìm kiếm
        </label>
        <Input
          defaultValue={values.q}
          id={`${idPrefix}-catalog-q`}
          maxLength={80}
          name="q"
          placeholder="Tên hoặc mô tả sản phẩm"
          type="search"
        />
      </div>
      <div>
        <label
          className="mb-2 block text-sm font-semibold"
          htmlFor={`${idPrefix}-catalog-category`}
        >
          Nhóm sản phẩm
        </label>
        <Select
          defaultValue={values.category ?? ''}
          id={`${idPrefix}-catalog-category`}
          name="category"
        >
          <option value="">Tất cả nhóm</option>
          {productCategories.map(([category, presentation]) => (
            <option key={category} value={category}>
              {presentation.label}
            </option>
          ))}
        </Select>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Khoảng giá</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
          <div>
            <label
              className="sr-only"
              htmlFor={`${idPrefix}-catalog-min-price`}
            >
              Giá tối thiểu
            </label>
            <Input
              defaultValue={values.minPrice}
              id={`${idPrefix}-catalog-min-price`}
              inputMode="numeric"
              name="minPrice"
              pattern="[0-9]+"
              placeholder="Từ"
            />
          </div>
          <div>
            <label
              className="sr-only"
              htmlFor={`${idPrefix}-catalog-max-price`}
            >
              Giá tối đa
            </label>
            <Input
              defaultValue={values.maxPrice}
              id={`${idPrefix}-catalog-max-price`}
              inputMode="numeric"
              name="maxPrice"
              pattern="[0-9]+"
              placeholder="Đến"
            />
          </div>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          className={buttonVariants({ className: 'flex-1' })}
          type="submit"
        >
          Áp dụng
        </button>
        <Link
          className={buttonVariants({ intent: 'secondary' })}
          href="/products"
        >
          Xóa lọc
        </Link>
      </div>
    </>
  );
}

export function ProductFilters({ values }: { values: FilterValues }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (mobileOpen && !dialog.open) dialog.showModal();
    if (!mobileOpen && dialog.open) dialog.close();
  }, [mobileOpen]);

  return (
    <>
      <aside
        aria-label="Bộ lọc sản phẩm"
        className="hidden border-r pr-6 lg:block"
        data-testid="desktop-product-filters"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal aria-hidden="true" className="size-5" />
          <h2 className="font-bold">Bộ lọc</h2>
        </div>
        <form className="mt-5 space-y-5" method="get">
          <FilterFields idPrefix="desktop" values={values} />
        </form>
      </aside>

      <div className="lg:hidden" data-testid="mobile-product-filters">
        <button
          aria-controls="mobile-product-filter-dialog"
          aria-expanded={mobileOpen}
          className={buttonVariants({
            className: 'w-full justify-between',
            intent: 'secondary',
          })}
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal aria-hidden="true" className="size-5" />
            Bộ lọc sản phẩm
          </span>
        </button>
        <dialog
          aria-labelledby="mobile-product-filter-title"
          className="motion-drawer m-0 ml-auto h-dvh max-h-none w-[min(23rem,calc(100vw-1.5rem))] max-w-none border-l bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-[var(--shadow-modal)] backdrop:bg-[#17242b]/55"
          data-testid="mobile-product-filter-drawer"
          id="mobile-product-filter-dialog"
          onClose={() => setMobileOpen(false)}
          ref={dialogRef}
        >
          <div className="flex min-h-16 items-center justify-between gap-3 border-b px-5">
            <h2 className="font-bold" id="mobile-product-filter-title">
              Bộ lọc sản phẩm
            </h2>
            <button
              aria-label="Đóng bộ lọc"
              className={buttonVariants({ intent: 'ghost', size: 'icon' })}
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <form className="grid gap-5 p-5" method="get">
            <FilterFields idPrefix="mobile" values={values} />
          </form>
        </dialog>
      </div>
    </>
  );
}
