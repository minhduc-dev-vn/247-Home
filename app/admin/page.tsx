import {
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  MapPinned,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { Card, CardContent } from '@/components/ui/card';
import { requirePageRole } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

const adminDestinations = [
  {
    description: 'Đơn hàng, lịch lắp đặt, bảo hành và audit log.',
    href: '/admin/operations',
    icon: BriefcaseBusiness,
    label: 'Operations',
  },
  {
    description: 'Sản phẩm, biến thể, gói dịch vụ và tồn kho.',
    href: '/admin/catalog',
    icon: Boxes,
    label: 'Catalog',
  },
  {
    description: 'Phạm vi phục vụ và chi phí theo khu vực.',
    href: '/admin/service-areas',
    icon: MapPinned,
    label: 'Khu vực phục vụ',
  },
];

export default async function AdminPage() {
  await requirePageRole('ADMIN');
  return (
    <main className="py-8 sm:py-10">
      <Container>
        <div className="flex items-start gap-4 border-b pb-6">
          <div className="grid size-11 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--primary)]">Quản trị</p>
            <h1 className="mt-1 text-3xl font-bold">Tổng quan hệ thống</h1>
            <p className="mt-2 text-[var(--muted)]">
              Chọn khu vực nghiệp vụ cần quản lý.
            </p>
          </div>
        </div>
        <section
          className="mt-7 grid gap-4 md:grid-cols-3"
          aria-label="Khu vực quản trị"
        >
          {adminDestinations.map(({ description, href, icon: Icon, label }) => (
            <Link className="group" href={href} key={href}>
              <Card className="h-full transition-colors group-hover:border-[var(--primary)]">
                <CardContent className="flex h-full flex-col">
                  <Icon
                    aria-hidden="true"
                    className="size-6 text-[var(--primary)]"
                  />
                  <h2 className="mt-5 text-lg font-bold">{label}</h2>
                  <p className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">
                    {description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                    Mở quản lý
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      </Container>
    </main>
  );
}
