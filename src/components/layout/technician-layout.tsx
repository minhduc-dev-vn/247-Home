import type { ReactNode } from 'react';

import { Header } from '@/components/layout/header';
import { technicianNavigation } from '@/components/layout/role-navigation';
import { Navbar } from '@/components/navigation/navbar';
import { SignOutButton } from '@/components/auth/sign-out-button';

export function TechnicianLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-16 md:pb-0">
      <Header
        actions={<SignOutButton className="hidden sm:inline-flex" />}
        navigation={technicianNavigation}
      />
      {children}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-[var(--surface)] px-2 py-1 md:hidden">
        <Navbar
          ariaLabel="Điều hướng kỹ thuật viên"
          className="[&_ul]:justify-around"
          items={technicianNavigation}
        />
      </div>
    </div>
  );
}
