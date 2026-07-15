import Link from 'next/link';

import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link className="text-sm font-medium text-[var(--primary)]" href="/">
        247 Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Tạo tài khoản</h1>
      <div className="mt-6 rounded-md border bg-white p-6">
        <RegisterForm />
      </div>
      <Link
        className="mt-5 text-sm text-[var(--primary)] underline"
        href="/login"
      >
        Đã có tài khoản
      </Link>
    </main>
  );
}
