import {
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  UserCircle,
  Wrench,
} from 'lucide-react';

import type { NavigationItem } from '@/components/navigation/navbar';
import type { RoleCode } from '@/modules/identity';

export function getCustomerNavigation(
  roles?: readonly RoleCode[],
): NavigationItem[] {
  const items: NavigationItem[] = [
    {
      href: '/products',
      icon: <PackageSearch aria-hidden="true" className="size-4" />,
      label: 'Sản phẩm',
    },
    {
      href: '/#installation',
      icon: <Wrench aria-hidden="true" className="size-4" />,
      label: 'Dịch vụ lắp đặt',
    },
    {
      href: '/warranty',
      icon: <Headphones aria-hidden="true" className="size-4" />,
      label: 'Bảo hành',
    },
  ];
  if (!roles || roles.includes('CUSTOMER')) {
    items.push({
      href: '/orders',
      icon: <ClipboardList aria-hidden="true" className="size-4" />,
      label: 'Đơn hàng',
    });
  }
  return items;
}

export function getAdminNavigation(
  roles: readonly RoleCode[],
): NavigationItem[] {
  const items: NavigationItem[] = [];
  if (roles.includes('ADMIN')) {
    items.push({
      href: '/admin',
      icon: <LayoutDashboard aria-hidden="true" className="size-4" />,
      label: 'Tổng quan',
    });
  }
  items.push(
    {
      href: '/admin/operations',
      icon: <BriefcaseBusiness aria-hidden="true" className="size-4" />,
      label: 'Vận hành',
    },
    {
      href: '/admin/catalog',
      icon: <Boxes aria-hidden="true" className="size-4" />,
      label: 'Catalog',
    },
    {
      href: '/admin/service-areas',
      icon: <MapPinned aria-hidden="true" className="size-4" />,
      label: 'Khu vực',
    },
    {
      href: '/account',
      icon: <UserCircle aria-hidden="true" className="size-4" />,
      label: 'Tài khoản',
    },
  );
  return items;
}

export const technicianNavigation: NavigationItem[] = [
  {
    href: '/technician/orders',
    icon: <BriefcaseBusiness aria-hidden="true" className="size-4" />,
    label: 'Công việc',
  },
  {
    href: '/account',
    icon: <UserCircle aria-hidden="true" className="size-4" />,
    label: 'Tài khoản',
  },
];
