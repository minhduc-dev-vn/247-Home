import { LogIn, ShoppingCart, UserCircle } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { getCustomerNavigation } from '@/components/layout/role-navigation';
import { buttonVariants } from '@/components/ui/button';
import type { RoleCode } from '@/modules/identity';

export function CustomerLayout({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: readonly RoleCode[];
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header
        actions={
          <>
            {roles ? (
              <Link
                className={buttonVariants({ intent: 'ghost', size: 'icon' })}
                href="/account"
                title="Tài khoản"
              >
                <UserCircle aria-hidden="true" className="size-5" />
                <span className="sr-only">Tài khoản</span>
              </Link>
            ) : (
              <Link
                className={buttonVariants({ intent: 'ghost', size: 'sm' })}
                href="/login"
              >
                <LogIn aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Đăng nhập</span>
              </Link>
            )}
            <Link
              className={buttonVariants({ intent: 'secondary', size: 'icon' })}
              href="/cart"
              title="Giỏ hàng"
            >
              <ShoppingCart aria-hidden="true" className="size-5" />
              <span className="sr-only">Giỏ hàng</span>
            </Link>
          </>
        }
        navigation={getCustomerNavigation(roles)}
      />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
