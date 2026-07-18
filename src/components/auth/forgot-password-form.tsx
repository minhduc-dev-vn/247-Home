'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useHydrated } from '@/components/auth/use-hydrated';
import { Alert } from '@/components/ui/alert';
import { PrimaryButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPasswordSchema } from '@/modules/identity/presentation/schemas';

type ForgotPasswordFormValues = { email: string };

export function ForgotPasswordForm() {
  const isHydrated = useHydrated();
  const [complete, setComplete] = useState(false);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    await fetch('/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    setComplete(true);
  }

  if (complete) {
    return (
      <Alert title="Kiểm tra hộp thư" variant="success">
        Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu đã được gửi.
      </Alert>
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
      <label className="block text-sm font-semibold" htmlFor="forgot-email">
        Email
        <Input
          aria-describedby={
            form.formState.errors.email ? 'forgot-email-error' : undefined
          }
          aria-invalid={Boolean(form.formState.errors.email)}
          autoComplete="email"
          className="mt-2"
          id="forgot-email"
          type="email"
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <span
            className="mt-1.5 block text-sm text-[var(--error)]"
            id="forgot-email-error"
          >
            Email không hợp lệ.
          </span>
        ) : null}
      </label>
      <PrimaryButton
        className="w-full"
        disabled={!isHydrated}
        loading={form.formState.isSubmitting}
        type="submit"
      >
        Gửi hướng dẫn
      </PrimaryButton>
    </form>
  );
}
