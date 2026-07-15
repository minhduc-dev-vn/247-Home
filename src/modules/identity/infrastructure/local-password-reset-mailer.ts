import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
};

export async function sendLocalPasswordResetEmail(
  email: PasswordResetEmail,
): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'The local password reset mailer is unavailable in production.',
    );
  }

  const outboxDirectory = join(process.cwd(), '.local-outbox');
  const filename = `${Date.now()}-${randomUUID()}.json`;
  await mkdir(outboxDirectory, { recursive: true });
  await writeFile(join(outboxDirectory, filename), JSON.stringify(email), {
    mode: 0o600,
  });
}
