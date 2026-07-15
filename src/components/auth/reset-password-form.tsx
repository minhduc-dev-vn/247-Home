'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { resetPasswordSchema } from '@/modules/identity/presentation/schemas';
import { useHydrated } from '@/components/auth/use-hydrated';

type ResetPasswordFormValues = { password: string };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const isHydrated = useHydrated();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema.omit({ token: true })),
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) {
      setMessage('Liên kết đặt lại không hợp lệ.');
      return;
    }

    const response = await fetch('/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: values.password }),
    });
    setMessage(
      response.ok
        ? 'Mật khẩu đã được đặt lại. Bạn có thể đăng nhập.'
        : 'Liên kết đặt lại không hợp lệ hoặc đã hết hạn.',
    );
  }

  return (
    <form
      className="space-y-4"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(onSubmit)(event);
      }}
    >
      <label className="block text-sm font-medium">
        Mật khẩu mới
        <input
          className="mt-1 block w-full rounded-md border bg-white px-3 py-2"
          type="password"
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <span className="mt-1 block text-sm text-red-700">
            Mật khẩu phải có ít nhất 12 ký tự.
          </span>
        )}
      </label>
      {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
      <button
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={!isHydrated || form.formState.isSubmitting}
        type="submit"
      >
        Đặt lại mật khẩu
      </button>
      <Link
        className="block text-sm text-[var(--primary)] underline"
        href="/login"
      >
        Về trang đăng nhập
      </Link>
    </form>
  );
}
