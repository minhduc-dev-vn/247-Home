import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationTests = [
  'scripts/test-operations-migration-upgrade.ts',
  'scripts/test-password-reset-outbox-migration-upgrade.ts',
] as const;

for (const migrationTest of migrationTests) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', migrationTest],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
