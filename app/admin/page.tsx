import Link from 'next/link';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { requirePageRole } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requirePageRole('ADMIN');

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link className="text-sm font-medium text-[var(--primary)]" href="/">
            247 Home
          </Link>
          <h1 className="mt-4 text-3xl font-semibold">Quản trị</h1>
          <p className="mt-3 text-[var(--muted)]">
            Không gian quản trị Identity and Access.
          </p>
        </div>
        <SignOutButton />
      </div>
    </main>
  );
}
