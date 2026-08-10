import { ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

import { Header } from '@/components/layout/header';
import { getAdminNavigation } from '@/components/layout/role-navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { SignOutButton } from '@/components/auth/sign-out-button';
import type { RoleCode } from '@/modules/identity';

export function AdminLayout({
  children,
  roles,
}: {
  children: ReactNode;
  roles: readonly RoleCode[];
}) {
  const navigation = getAdminNavigation(roles);
  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--background)]">
      <Header
        actions={
          <span className="hidden items-center gap-2 text-sm font-medium text-[var(--muted)] sm:flex">
            <ShieldCheck aria-hidden="true" className="size-4" />
            {roles.join(', ')}
          </span>
        }
        navigation={navigation}
      />
      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar
          footer={<SignOutButton className="w-full" />}
          items={navigation}
          label="Quản trị"
        />
        <div className="w-full min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
