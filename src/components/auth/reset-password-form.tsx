'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useHydrated } from '@/components/auth/use-hydrated';
import { Alert } from '@/components/ui/alert';
import { PrimaryButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPasswordSchema } from '@/modules/identity/presentation/schemas';

type ResetPasswordFormValues = { password: string };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const isHydrated = useHydrated();
  const [message, setMessage] = useState<{
    text: string;
    variant: 'error' | 'success';
  } | null>(null);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema.omit({ token: true })),
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) {
      setMessage({ text: 'Liên kết đặt lại không hợp lệ.', variant: 'error' });
      return;
    }
    const response = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: values.password }),
    });
    setMessage(
      response.ok
        ? {
            text: 'Mật khẩu đã được đặt lại. Bạn có thể đăng nhập.',
            variant: 'success',
          }
        : {
            text: 'Liên kết đặt lại không hợp lệ hoặc đã hết hạn.',
            variant: 'error',
          },
    );
  }

  return (
    <form
      className="space-y-5"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(onSubmit)(event);
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="reset-password">
        Mật khẩu mới
        <Input
          aria-describedby={
            form.formState.errors.password ? 'reset-password-error' : undefined
          }
          aria-invalid={Boolean(form.formState.errors.password)}
          autoComplete="new-password"
          className="mt-2"
          id="reset-password"
          type="password"
          {...form.register('password')}
        />
        {form.formState.errors.password ? (
          <span
            className="mt-1.5 block text-sm text-[var(--error)]"
            id="reset-password-error"
          >
            Mật khẩu phải có ít nhất 12 ký tự.
          </span>
        ) : null}
      </label>
      {message ? <Alert variant={message.variant}>{message.text}</Alert> : null}
      <PrimaryButton
        className="w-full"
        disabled={!isHydrated}
        loading={form.formState.isSubmitting}
        type="submit"
      >
        Đặt lại mật khẩu
      </PrimaryButton>
      <Link
        className="block text-center text-sm font-semibold text-[var(--primary)]"
        href="/login"
      >
        Về trang đăng nhập
      </Link>
    </form>
  );
}
