import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const database = 'home247_upgrade';
const password = 'test-only-operations-upgrade';
const priorMigrations = [
  '20260713000000_bootstrap',
  '20260713095321_identity_and_access',
  '20260713113000_catalog_inventory',
  '20260713150000_checkout_orders_installation',
  '20260713170000_operations',
  '20260713173000_operations_schedule_and_reschedule',
] as const;
const postOperationsMigrations = [
  '20260714130000_payment_workflow',
  '20260715100000_inventory_allocation_integrity',
  '20260715101000_address_default_integrity',
] as const;

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

function requireSuccess(result: CommandResult, operation: string) {
  if (result.status !== 0) {
    throw new Error(`${operation} failed:\n${output(result)}`);
  }
}

function sleep(milliseconds: number) {
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

function waitForPostgres(container: string) {
  let consecutiveConnections = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = psql(container, 'SELECT 1;');
    consecutiveConnections =
      ready.status === 0 ? consecutiveConnections + 1 : 0;
    if (consecutiveConnections === 2) return;
    sleep(250);
  }
  throw new Error(
    `PostgreSQL test container ${container} did not become ready.`,
  );
}

function startContainer(label: string): string {
  const container = `home247-operations-upgrade-${label}-${randomUUID().slice(0, 8)}`;
  const started = docker([
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
    'postgres:16-alpine',
  ]);
  requireSuccess(started, `start ${label} PostgreSQL container`);
  waitForPostgres(container);
  return container;
}

function stopContainer(container: string) {
  const stopped = docker(['stop', '--time', '0', container]);
  if (stopped.status !== 0) {
    process.stderr.write(
      `Warning: could not stop ephemeral container ${container}:\n${output(stopped)}`,
    );
  }
}

function applyPriorMigrations(container: string) {
  for (const migration of priorMigrations) {
    requireSuccess(
      psql(container, sql(`prisma/migrations/${migration}/migration.sql`)),
      `apply ${migration}`,
    );
  }
}

function prepareScenario(container: string) {
  applyPriorMigrations(container);
  requireSuccess(
    psql(container, sql('tests/migration/operations-progressed-fixture.sql')),
    'insert progressed assignment fixtures',
  );
}

function applyMigration(container: string, migration: string) {
  requireSuccess(
    psql(container, sql(`prisma/migrations/${migration}/migration.sql`)),
    `apply ${migration}`,
  );
}

function runValidUpgrade() {
  const container = startContainer('valid');
  try {
    prepareScenario(container);
    applyMigration(
      container,
      '20260714110000_operations_assignment_timestamp_forward_fix',
    );
    for (const migration of postOperationsMigrations)
      applyMigration(container, migration);
    requireSuccess(
      psql(container, sql('tests/migration/operations-upgrade-assertions.sql')),
      'verify progressed assignment upgrade',
    );
    requireSuccess(
      psql(container, sql('tests/migration/system-integrity-assertions.sql')),
      'verify current integrity migrations',
    );
  } finally {
    stopContainer(container);
  }
}

function runInvalidUpgrade() {
  const container = startContainer('invalid');
  try {
    prepareScenario(container);
    requireSuccess(
      psql(container, sql('tests/migration/operations-invalid-history.sql')),
      'insert contradictory assignment history',
    );
    const migration = psql(
      container,
      sql(
        'prisma/migrations/20260714110000_operations_assignment_timestamp_forward_fix/migration.sql',
      ),
    );
    if (
      migration.status === 0 ||
      !output(migration).includes('OPERATIONS_TIMESTAMP_HISTORY_INVALID')
    ) {
      throw new Error(
        `invalid history was not rejected with the expected error:\n${output(migration)}`,
      );
    }
    requireSuccess(
      psql(
        container,
        sql('tests/migration/operations-invalid-rollback-assertions.sql'),
      ),
      'verify failed upgrade rollback',
    );
  } finally {
    stopContainer(container);
  }
}

function runInvalidAddressUpgrade() {
  const container = startContainer('invalid-address');
  try {
    prepareScenario(container);
    applyMigration(
      container,
      '20260714110000_operations_assignment_timestamp_forward_fix',
    );
    applyMigration(container, '20260714130000_payment_workflow');
    applyMigration(container, '20260715100000_inventory_allocation_integrity');
    requireSuccess(
      psql(container, sql('tests/migration/address-duplicate-fixture.sql')),
      'insert duplicate default-address history',
    );
    const migration = psql(
      container,
      sql(
        'prisma/migrations/20260715101000_address_default_integrity/migration.sql',
      ),
    );
    if (
      migration.status === 0 ||
      !output(migration).includes('ADDRESS_DEFAULT_HISTORY_INVALID')
    )
      throw new Error(
        `duplicate address history was not rejected as expected:\n${output(migration)}`,
      );
    requireSuccess(
      psql(
        container,
        sql('tests/migration/address-invalid-rollback-assertions.sql'),
      ),
      'verify failed default-address migration rollback',
    );
  } finally {
    stopContainer(container);
  }
}

runValidUpgrade();
runInvalidUpgrade();
runInvalidAddressUpgrade();
process.stdout.write(
  'Migration upgrade: current valid history PASS; Operations and address invalid-history rejection/rollback PASS.\n',
);
