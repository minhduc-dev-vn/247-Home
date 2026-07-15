'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      className="rounded-md border px-4 py-2 text-sm font-medium"
      onClick={() => signOut({ callbackUrl: '/' })}
      type="button"
    >
      Đăng xuất
    </button>
  );
}
