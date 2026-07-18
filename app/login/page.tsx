import Link from 'next/link';

import { LoginForm } from '@/components/auth/login-form';
import { AuthLayout } from '@/components/layout/auth-layout';

export default function LoginPage() {
  return (
    <AuthLayout
      description="Đăng nhập để quản lý đơn hàng, lịch lắp đặt hoặc công việc được phân công."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="font-semibold text-[var(--primary)]"
            href="/register"
          >
            Tạo tài khoản
          </Link>
          <Link
            className="font-semibold text-[var(--primary)]"
            href="/forgot-password"
          >
            Quên mật khẩu?
          </Link>
        </div>
      }
      title="Đăng nhập"
    >
      <LoginForm />
    </AuthLayout>
  );
}
