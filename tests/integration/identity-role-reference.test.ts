import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient, RoleCode } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { createCustomer } from '@/modules/identity/infrastructure/user-repository';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const database = 'identity_reference_test';
const password = 'test-only-identity-reference';
const postgresImage =
  'postgres:16-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777';

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
    throw new Error(`${operation} failed: ${output(result)}`);
}

function sleep(milliseconds: number): void {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    milliseconds,
  );
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
    'Identity reference test PostgreSQL container did not become ready.',
  );
}

function migrationSql(name: string): string {
  return readFileSync(
    resolve(root, 'prisma', 'migrations', name, 'migration.sql'),
    'utf8',
  );
}

function publishedPort(container: string): string {
  const result = docker(['port', container, '5432/tcp']);
  requireSuccess(result, 'read PostgreSQL published port');
  const match = output(result)
    .trim()
    .match(/:(\d+)$/m);
  if (!match) throw new Error('PostgreSQL published port could not be parsed.');
  return match[1];
}

describe('identity role reference data on PostgreSQL', () => {
  it('self-heals a missing CUSTOMER role before the reference-data migration runs', async () => {
    const container = `home247-identity-role-${randomUUID().slice(0, 8)}`;
    let client: PrismaClient | undefined;
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
          '--publish',
          '127.0.0.1::5432',
          postgresImage,
        ]),
        'start identity reference PostgreSQL container',
      );
      waitForPostgres(container);
      requireSuccess(
        psql(container, migrationSql('20260713000000_bootstrap')),
        'apply bootstrap migration',
      );
      requireSuccess(
        psql(container, migrationSql('20260713095321_identity_and_access')),
        'apply identity migration without reference data',
      );

      client = new PrismaClient({
        datasources: {
          db: {
            url: `postgresql://postgres:${password}@127.0.0.1:${publishedPort(container)}/${database}?schema=public`,
          },
        },
      });
      const user = await createCustomer(
        {
          name: 'Role Reference Customer',
          email: 'role-reference@example.test',
          passwordHash:
            '$2b$12$DBUle2zaTvc3QObuxzRYeOjV3ph/v3BY1PowqetVinsGc.dwAKM/u',
        },
        client,
      );

      expect(user.roles).toHaveLength(1);
      expect(user.roles[0].role.code).toBe(RoleCode.CUSTOMER);
      await expect(
        client.role.count({ where: { code: RoleCode.CUSTOMER } }),
      ).resolves.toBe(1);

      requireSuccess(
        psql(
          container,
          migrationSql('20260726120000_identity_role_reference_data'),
        ),
        'apply role reference-data migration after self-heal',
      );
      await expect(
        client.role.count({ where: { code: RoleCode.CUSTOMER } }),
      ).resolves.toBe(1);
    } finally {
      await client?.$disconnect();
      const stopped = docker(['stop', '--time', '0', container]);
      if (stopped.status !== 0 && stopped.status !== 1) {
        throw new Error(
          `stop identity reference PostgreSQL container failed: ${output(stopped)}`,
        );
      }
    }
  }, 60_000);
});
