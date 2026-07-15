import Link from 'next/link';
import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link className="text-sm font-medium text-[var(--primary)]" href="/login">
        247 Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Đặt lại mật khẩu</h1>
      <div className="mt-6 rounded-md border bg-white p-6">
        <Suspense
          fallback={
            <p className="text-sm text-[var(--muted)]">Đang tải biểu mẫu.</p>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
