'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { SecondaryButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SignOutButton({ className }: { className?: string }) {
  return (
    <SecondaryButton
      className={cn(className)}
      onClick={() => signOut({ callbackUrl: '/' })}
      type="button"
    >
      <LogOut aria-hidden="true" className="size-4" />
      Đăng xuất
    </SecondaryButton>
  );
}
