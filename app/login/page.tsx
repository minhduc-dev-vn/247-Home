import Link from 'next/link';

import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link className="text-sm font-medium text-[var(--primary)]" href="/">
        247 Home
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">Đăng nhập</h1>
      <div className="mt-6 rounded-md border bg-white p-6">
        <LoginForm />
      </div>
      <div className="mt-5 flex gap-4 text-sm text-[var(--primary)]">
        <Link className="underline" href="/register">
          Tạo tài khoản
        </Link>
        <Link className="underline" href="/forgot-password">
          Quên mật khẩu
        </Link>
      </div>
    </main>
  );
}
