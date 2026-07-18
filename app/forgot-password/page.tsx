import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { AuthLayout } from '@/components/layout/auth-layout';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      description="Nhập email tài khoản. Hệ thống luôn trả cùng một thông báo để bảo vệ thông tin người dùng."
      footer={
        <Link className="font-semibold text-[var(--primary)]" href="/login">
          Về trang đăng nhập
        </Link>
      }
      title="Quên mật khẩu"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
