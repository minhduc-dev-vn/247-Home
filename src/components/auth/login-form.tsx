'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useHydrated } from '@/components/auth/use-hydrated';
import { Alert } from '@/components/ui/alert';
import { PrimaryButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginSchema } from '@/modules/identity/presentation/schemas';

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
      className="space-y-5"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(onSubmit)(event);
      }}
    >
      <label className="block text-sm font-semibold" htmlFor="login-email">
        Email
        <Input
          aria-describedby={
            form.formState.errors.email ? 'login-email-error' : undefined
          }
          aria-invalid={Boolean(form.formState.errors.email)}
          autoComplete="email"
          className="mt-2"
          id="login-email"
          type="email"
          {...form.register('email')}
        />
        {form.formState.errors.email ? (
          <span
            className="mt-1.5 block text-sm text-[var(--error)]"
            id="login-email-error"
          >
            Email không hợp lệ.
          </span>
        ) : null}
      </label>
      <label className="block text-sm font-semibold" htmlFor="login-password">
        Mật khẩu
        <Input
          aria-describedby={
            form.formState.errors.password ? 'login-password-error' : undefined
          }
          aria-invalid={Boolean(form.formState.errors.password)}
          autoComplete="current-password"
          className="mt-2"
          id="login-password"
          type="password"
          {...form.register('password')}
        />
        {form.formState.errors.password ? (
          <span
            className="mt-1.5 block text-sm text-[var(--error)]"
            id="login-password-error"
          >
            Mật khẩu phải có ít nhất 12 ký tự.
          </span>
        ) : null}
      </label>
      {message ? <Alert variant="error">{message}</Alert> : null}
      <PrimaryButton
        className="w-full"
        disabled={!isHydrated}
        loading={form.formState.isSubmitting}
        type="submit"
      >
        Đăng nhập
      </PrimaryButton>
    </form>
  );
}
