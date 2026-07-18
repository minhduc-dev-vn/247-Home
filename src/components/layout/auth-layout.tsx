import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

export function AuthLayout({
  children,
  description,
  footer,
  title,
}: {
  children: ReactNode;
  description: string;
  footer?: ReactNode;
  title: string;
}) {
  return (
    <main className="grid min-h-screen bg-[var(--surface)] lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]">
      <section className="relative hidden min-h-screen overflow-hidden lg:block">
        <Image
          alt="Thiết bị nhà thông minh được lắp đặt tại căn hộ"
          className="object-cover"
          fill
          priority
          sizes="60vw"
          src="/images/smart-home-entryway.png"
        />
        <div className="absolute inset-x-0 bottom-0 bg-[#102d31]/88 p-10 text-white">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5" />
            247 Home
          </p>
          <p className="mt-3 max-w-lg text-2xl font-semibold">
            Thiết bị chính hãng, lắp đặt tận nơi, vận hành an tâm.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-[var(--background)] px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            247 Home
          </Link>
          <div className="mt-8">
            <p className="text-sm font-semibold text-[var(--primary)]">
              Tài khoản 247 Home
            </p>
            <h1 className="mt-2 text-3xl font-bold">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>
          </div>
          <Card className="mt-7">
            <CardContent>{children}</CardContent>
          </Card>
          {footer ? (
            <div className="mt-5 text-sm text-[var(--muted)]">{footer}</div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
