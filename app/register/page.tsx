import Link from 'next/link';

import { RegisterForm } from '@/components/auth/register-form';
import { AuthLayout } from '@/components/layout/auth-layout';

export default function RegisterPage() {
  return (
    <AuthLayout
      description="Tạo tài khoản khách hàng để mua sản phẩm, đặt lịch lắp đặt và theo dõi đơn hàng."
      footer={
        <p>
          Đã có tài khoản?{' '}
          <Link className="font-semibold text-[var(--primary)]" href="/login">
            Đăng nhập
          </Link>
        </p>
      }
      title="Tạo tài khoản"
    >
      <RegisterForm />
    </AuthLayout>
  );
}
