import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const database = 'home247_password_reset_upgrade';
const password = 'test-only-password-reset-upgrade';
const postgresImage =
  'postgres:16-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777';
const priorMigrations = [
  '20260713000000_bootstrap',
  '20260713095321_identity_and_access',
  '20260713113000_catalog_inventory',
  '20260713150000_checkout_orders_installation',
  '20260713170000_operations',
  '20260713173000_operations_schedule_and_reschedule',
  '20260713190000_operations_domain_integrity',
  '20260714110000_operations_assignment_timestamp_forward_fix',
  '20260714130000_payment_workflow',
  '20260715100000_inventory_allocation_integrity',
  '20260715101000_address_default_integrity',
  '20260718100000_warranty_rejected_status',
  '20260718101000_customer_warranty_backend',
  '20260718120000_warranty_create_idempotency',
  '20260722120000_online_payment_vnpay',
  '20260726120000_identity_role_reference_data',
] as const;
const migration = '20260728120000_identity_password_reset_outbox';

type CommandResult = ReturnType<typeof spawnSync>;

function docker(args: string[], input?: string): CommandResult {
  return spawnSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function output(result: CommandResult): string {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function requireSuccess(result: CommandResult, operation: string): void {
  if (result.status !== 0)
    throw new Error(`${operation} failed:\n${output(result)}`);
}

function sleep(milliseconds: number): void {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    milliseconds,
  );
}

function sql(path: string): string {
  return readFileSync(resolve(root, path), 'utf8');
}

function psql(container: string, source: string): CommandResult {
  return docker(
    [
      'exec',
      '-i',
      container,
      'psql',
      '--set',
      'ON_ERROR_STOP=1',
      '--username',
      'postgres',
      '--dbname',
      database,
    ],
    source,
  );
}

function waitForPostgres(container: string): void {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (psql(container, 'SELECT 1;').status === 0) return;
    sleep(250);
  }
  throw new Error(
    'Password-reset upgrade PostgreSQL container did not become ready.',
  );
}

function migrationSql(name: string): string {
  return sql(`prisma/migrations/${name}/migration.sql`);
}

function applyMigration(container: string, name: string): void {
  requireSuccess(psql(container, migrationSql(name)), `apply ${name}`);
}

function stopContainer(container: string): void {
  const stopped = docker(['stop', '--time', '0', container]);
  if (stopped.status !== 0) {
    process.stderr.write(
      `Warning: could not stop password-reset upgrade container ${container}.\n`,
    );
  }
}

function runUpgrade(): void {
  const container = `home247-password-reset-upgrade-${randomUUID().slice(0, 8)}`;
  try {
    requireSuccess(
      docker([
        'run',
        '--rm',
        '--detach',
        '--name',
        container,
        '--tmpfs',
        '/var/lib/postgresql/data:rw',
        '--env',
        `POSTGRES_PASSWORD=${password}`,
        '--env',
        `POSTGRES_DB=${database}`,
        postgresImage,
      ]),
      'start password-reset upgrade PostgreSQL container',
    );
    waitForPostgres(container);
    for (const name of priorMigrations) applyMigration(container, name);

    requireSuccess(
      psql(
        container,
        [
          'INSERT INTO "users" ("id", "email", "name", "password_hash", "updated_at")',
          "VALUES ('legacy-password-reset-user', 'legacy-reset@example.test', 'Legacy Reset User', 'not-a-real-password-hash', CURRENT_TIMESTAMP);",
          'INSERT INTO "password_reset_tokens" ("id", "user_id", "token_hash", "expires_at")',
          "VALUES ('legacy-password-reset-token', 'legacy-password-reset-user', repeat('a', 64), CURRENT_TIMESTAMP + INTERVAL '1 hour');",
        ].join('\n'),
      ),
      'insert legacy password reset fixture',
    );
    applyMigration(container, migration);
    requireSuccess(
      psql(
        container,
        sql('tests/migration/password-reset-outbox-upgrade-assertions.sql'),
      ),
      'verify password reset outbox upgrade',
    );
  } finally {
    stopContainer(container);
  }
}

runUpgrade();
process.stdout.write(
  'Migration upgrade: password-reset outbox clean-schema and legacy-token preservation PASS.\n',
);
