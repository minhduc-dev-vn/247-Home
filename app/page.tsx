import { ArrowRight, House } from 'lucide-react';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-16 sm:px-10">
      <div className="flex items-center gap-3 text-[var(--primary)]">
        <House aria-hidden="true" className="size-7" />
        <span className="text-lg font-semibold">247 Home</span>
        <nav className="ml-auto flex gap-4 text-sm font-medium">
          <Link href="/login">Đăng nhập</Link>
          <Link href="/register">Tạo tài khoản</Link>
        </nav>
      </div>
      <section className="mt-20 max-w-2xl">
        <p className="text-sm font-medium text-[var(--muted)]">
          Nền tảng đang được xây dựng
        </p>
        <h1 className="mt-4 text-4xl leading-tight font-semibold sm:text-5xl">
          Thiết bị nhà thông minh, lắp đặt tận nơi.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
          247 Home đang hoàn thiện trải nghiệm mua thiết bị an ninh và nhà thông
          minh cùng dịch vụ lắp đặt.
        </p>
        <Button className="mt-8" disabled type="button">
          Sắp ra mắt
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </section>
    </main>
  );
}
