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
import { registrationSchema } from '@/modules/identity/presentation/schemas';

type RegistrationFormValues = { name: string; email: string; password: string };

export function RegisterForm() {
  const router = useRouter();
  const isHydrated = useHydrated();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
  });

  async function onSubmit(values: RegistrationFormValues) {
    setMessage(null);
    const response = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      setMessage('Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin.');
      return;
    }
    const result = await signIn('credentials', {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (result?.error) {
      router.push('/login');
      return;
    }
    router.push('/account');
    router.refresh();
  }

  const fields = [
    {
      autoComplete: 'name',
      error: form.formState.errors.name,
      id: 'register-name',
      label: 'Họ tên',
      name: 'name' as const,
      type: 'text',
      errorText: 'Nhập họ tên của bạn.',
    },
    {
      autoComplete: 'email',
      error: form.formState.errors.email,
      id: 'register-email',
      label: 'Email',
      name: 'email' as const,
      type: 'email',
      errorText: 'Email không hợp lệ.',
    },
    {
      autoComplete: 'new-password',
      error: form.formState.errors.password,
      id: 'register-password',
      label: 'Mật khẩu',
      name: 'password' as const,
      type: 'password',
      errorText: 'Mật khẩu phải có ít nhất 12 ký tự.',
    },
  ];

  return (
    <form
      className="space-y-5"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(onSubmit)(event);
      }}
    >
      {fields.map((field) => (
        <label
          className="block text-sm font-semibold"
          htmlFor={field.id}
          key={field.id}
        >
          {field.label}
          <Input
            aria-describedby={field.error ? `${field.id}-error` : undefined}
            aria-invalid={Boolean(field.error)}
            autoComplete={field.autoComplete}
            className="mt-2"
            id={field.id}
            type={field.type}
            {...form.register(field.name)}
          />
          {field.error ? (
            <span
              className="mt-1.5 block text-sm text-[var(--error)]"
              id={`${field.id}-error`}
            >
              {field.errorText}
            </span>
          ) : null}
        </label>
      ))}
      {message ? <Alert variant="error">{message}</Alert> : null}
      <PrimaryButton
        className="w-full"
        disabled={!isHydrated}
        loading={form.formState.isSubmitting}
        type="submit"
      >
        Tạo tài khoản
      </PrimaryButton>
    </form>
  );
}
