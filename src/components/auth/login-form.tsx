'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { loginSchema } from '@/modules/identity/presentation/schemas';
import { useHydrated } from '@/components/auth/use-hydrated';

type LoginFormValues = { email: string; password: string };

export function LoginForm() {
  const router = useRouter();
  const isHydrated = useHydrated();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setMessage(null);
    const result = await signIn('credentials', { ...values, redirect: false });

    if (result?.error) {
      setMessage('Email hoặc mật khẩu không hợp lệ.');
      return;
    }

    router.push('/account');
    router.refresh();
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
      <label className="block text-sm font-medium">
        Mật khẩu
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
      {message && <p className="text-sm text-red-700">{message}</p>}
      <button
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={!isHydrated || form.formState.isSubmitting}
        type="submit"
      >
        Đăng nhập
      </button>
    </form>
  );
}
