'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { forgotPasswordSchema } from '@/modules/identity/presentation/schemas';
import { useHydrated } from '@/components/auth/use-hydrated';

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
      <p className="text-sm text-[var(--muted)]">
        Nếu email hợp lệ, hướng dẫn đặt lại đã được gửi.
      </p>
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
        Email
        <input
          className="mt-1 block w-full rounded-md border bg-white px-3 py-2"
          type="email"
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <span className="mt-1 block text-sm text-red-700">
            Email không hợp lệ.
          </span>
        )}
      </label>
      <button
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={!isHydrated || form.formState.isSubmitting}
        type="submit"
      >
        Gửi hướng dẫn
      </button>
    </form>
  );
}
