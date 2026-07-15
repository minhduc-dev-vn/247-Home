import Link from 'next/link';

import { listAdminProducts } from '@/modules/catalog';
import { requirePageRole } from '@/shared/auth/server';
import { formatVnd } from '@/shared/money/format-vnd';

export const dynamic = 'force-dynamic';

export default async function CatalogAdminPage() {
  await requirePageRole('STAFF', 'MANAGER', 'ADMIN');
  const catalog = await listAdminProducts();
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 sm:px-10">
      <header className="flex flex-wrap items-center gap-4 border-b pb-6">
        <Link className="font-semibold text-[var(--primary)]" href="/">
          247 Home
        </Link>
        <h1 className="text-2xl font-semibold">Quan ly catalog</h1>
        <Link
          className="ml-auto text-sm font-medium text-[var(--primary)]"
          href="/admin/service-areas"
        >
          Khu vuc phuc vu
        </Link>
      </header>
      <p className="mt-5 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Danh sach van hanh. API admin cung cap thao tac tao, sua va archive;
        STAFF quan ly catalog, con thay doi gia yeu cau MANAGER hoac ADMIN.
      </p>
      <div className="mt-8 overflow-x-auto border bg-white">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b bg-[#f7f8fa] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">San pham</th>
              <th className="px-4 py-3">Trang thai</th>
              <th className="px-4 py-3">Bien the</th>
              <th className="px-4 py-3">Gia</th>
              <th className="px-4 py-3">Ton kha dung</th>
            </tr>
          </thead>
          <tbody>
            {catalog.items.flatMap((product) =>
              product.variants.map((variant, index) => (
                <tr className="border-b last:border-0" key={variant.id}>
                  <td className="px-4 py-3">
                    {index === 0 ? product.name : ''}
                  </td>
                  <td className="px-4 py-3">
                    {index === 0 ? product.status : ''}
                  </td>
                  <td className="px-4 py-3">
                    {variant.name}{' '}
                    <span className="text-[var(--muted)]">{variant.sku}</span>
                  </td>
                  <td className="px-4 py-3">{formatVnd(variant.priceVnd)}</td>
                  <td className="px-4 py-3">
                    {variant.inventory?.available ?? 0}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
