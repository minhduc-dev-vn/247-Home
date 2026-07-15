import Link from 'next/link';

import { listServiceAreas } from '@/modules/catalog';
import { requirePageRole } from '@/shared/auth/server';
import { formatVnd } from '@/shared/money/format-vnd';

export const dynamic = 'force-dynamic';

export default async function ServiceAreasAdminPage() {
  await requirePageRole('MANAGER', 'ADMIN');
  const areas = await listServiceAreas(true);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 sm:px-10">
      <header className="flex items-center gap-4 border-b pb-6">
        <Link
          className="font-semibold text-[var(--primary)]"
          href="/admin/catalog"
        >
          Catalog
        </Link>
        <h1 className="text-2xl font-semibold">Khu vuc phuc vu</h1>
      </header>
      <div className="mt-8 divide-y border bg-white">
        {areas.items.map((area) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 p-4"
            key={area.id}
          >
            <div>
              <p className="font-medium">
                {area.provinceName}, {area.districtName}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {area.code} · {area.isActive ? 'Dang phuc vu' : 'Tam dung'}
              </p>
            </div>
            <p className="text-sm">
              Lap dat {formatVnd(area.installationFeeVnd)}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
