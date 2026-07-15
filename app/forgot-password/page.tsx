import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link className="text-sm font-medium text-[var(--primary)]" href="/login">
        247 Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Quên mật khẩu</h1>
      <div className="mt-6 rounded-md border bg-white p-6">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
