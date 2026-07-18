import { Suspense } from 'react';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Loading } from '@/components/ui/loading';

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      description="Chọn mật khẩu mới có ít nhất 12 ký tự cho tài khoản của bạn."
      title="Đặt lại mật khẩu"
    >
      <Suspense fallback={<Loading label="Đang tải biểu mẫu..." />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
