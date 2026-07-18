import {
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  PackageSearch,
  ShoppingCart,
  UserCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { Container } from '@/components/layout/container';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getOwnProfile, type RoleCode } from '@/modules/identity';
import { requirePageActor } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

type Destination = {
  description: string;
  href: string;
  icon: ReactNode;
  label: string;
};

function getDestinations(roles: readonly RoleCode[]): Destination[] {
  const destinations: Destination[] = [];
  if (roles.includes('CUSTOMER')) {
    destinations.push(
      {
        description: 'Khám phá thiết bị và gói lắp đặt phù hợp.',
        href: '/products',
        icon: <PackageSearch aria-hidden="true" className="size-5" />,
        label: 'Sản phẩm',
      },
      {
        description: 'Kiểm tra sản phẩm đã chọn trước khi đặt hàng.',
        href: '/cart',
        icon: <ShoppingCart aria-hidden="true" className="size-5" />,
        label: 'Giỏ hàng',
      },
      {
        description: 'Theo dõi trạng thái và lịch lắp đặt của bạn.',
        href: '/orders',
        icon: <ClipboardList aria-hidden="true" className="size-5" />,
        label: 'Đơn hàng của tôi',
      },
    );
  }
  if (roles.some((role) => ['STAFF', 'MANAGER', 'ADMIN'].includes(role))) {
    destinations.push(
      {
        description: 'Theo dõi đơn hàng, lắp đặt, bảo hành và audit.',
        href: '/admin/operations',
        icon: <BriefcaseBusiness aria-hidden="true" className="size-5" />,
        label: 'Operations',
      },
      {
        description: 'Quản lý catalog, biến thể và tồn kho.',
        href: '/admin/catalog',
        icon: <Boxes aria-hidden="true" className="size-5" />,
        label: 'Catalog',
      },
    );
  }
  if (roles.includes('ADMIN')) {
    destinations.unshift({
      description: 'Truy cập không gian quản trị hệ thống.',
      href: '/admin',
      icon: <LayoutDashboard aria-hidden="true" className="size-5" />,
      label: 'Tổng quan quản trị',
    });
  }
  if (roles.includes('TECHNICIAN')) {
    destinations.push({
      description: 'Xem lịch và cập nhật công việc được phân công.',
      href: '/technician',
      icon: <BriefcaseBusiness aria-hidden="true" className="size-5" />,
      label: 'Công việc kỹ thuật',
    });
  }
  return destinations;
}

export default async function AccountPage() {
  const actor = await requirePageActor();
  const profile = await getOwnProfile(actor, actor.userId);
  if (!profile) return null;
  const destinations = getDestinations(profile.roles);

  return (
    <main className="py-10 sm:py-14">
      <Container className="max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--primary)]">Tài khoản</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Xin chào, {profile.name}
            </h1>
            <p className="mt-3 text-[var(--muted)]">
              Chọn không gian bạn muốn tiếp tục.
            </p>
          </div>
          <SignOutButton />
        </div>

        <section className="mt-8" aria-labelledby="workspace-title">
          <h2 className="text-xl font-bold" id="workspace-title">
            Không gian làm việc
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((item) => (
              <Link className="group" href={item.href} key={item.href}>
                <Card className="h-full transition-colors group-hover:border-[var(--primary)]">
                  <CardContent className="flex h-full flex-col">
                    <div className="grid size-10 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                      {item.icon}
                    </div>
                    <h3 className="mt-4 font-bold">{item.label}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">
                      {item.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]">
                      Mở không gian
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <Card className="mt-8">
          <CardContent className="grid gap-6 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
            <div className="grid size-12 place-items-center rounded-lg bg-[var(--secondary)] text-[var(--primary)]">
              <UserCircle aria-hidden="true" className="size-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--muted)]">Email</p>
              <p className="mt-1 font-semibold break-all">{profile.email}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--muted)]">Vai trò</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.roles.map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
