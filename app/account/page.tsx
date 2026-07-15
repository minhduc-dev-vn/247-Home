import Link from 'next/link';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { getOwnProfile } from '@/modules/identity';
import { requirePageActor } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const actor = await requirePageActor();
  const profile = await getOwnProfile(actor, actor.userId);

  if (!profile) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link className="text-sm font-medium text-[var(--primary)]" href="/">
        247 Home
      </Link>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">Tài khoản</p>
          <h1 className="mt-2 text-3xl font-semibold">{profile.name}</h1>
        </div>
        <SignOutButton />
      </div>
      <dl className="mt-8 grid gap-5 rounded-md border bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-[var(--muted)]">Email</dt>
          <dd className="mt-1 font-medium">{profile.email}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--muted)]">Vai trò</dt>
          <dd className="mt-1 font-medium">{profile.roles.join(', ')}</dd>
        </div>
      </dl>
    </main>
  );
}
