import { describe, expect, it } from 'vitest';

import {
  assertLocalDemoRuntime,
  buildWindowsPnpmCommand,
} from '../../scripts/demo-runtime';

const localEnvironment = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/home247',
  LOCAL_DEMO: 'true',
  NODE_ENV: 'development',
};

describe('local demo runtime guard', () => {
  it('accepts the approved local database for non-destructive tooling', () => {
    expect(
      assertLocalDemoRuntime(localEnvironment, { destructive: false }),
    ).toEqual({ database: 'home247', host: 'localhost' });
  });

  it('requires explicit destructive reset approval', () => {
    expect(() =>
      assertLocalDemoRuntime(localEnvironment, { destructive: true }),
    ).toThrow('DEMO_RESET_ALLOWED');
  });

  it('rejects production and remote database targets', () => {
    expect(() =>
      assertLocalDemoRuntime(
        { ...localEnvironment, NODE_ENV: 'production' },
        { destructive: false },
      ),
    ).toThrow('NODE_ENV=production');
    expect(() =>
      assertLocalDemoRuntime(
        {
          ...localEnvironment,
          DATABASE_URL: 'postgresql://user:password@db.example.test/home247',
        },
        { destructive: false },
      ),
    ).toThrow('only accepts');
  });

  it('builds an allowlisted Windows pnpm command without shell metacharacters', () => {
    expect(
      buildWindowsPnpmCommand(['exec', 'prisma', 'migrate', '--force']),
    ).toBe('pnpm exec prisma migrate --force');
    expect(() =>
      buildWindowsPnpmCommand(['demo:verify', '&&', 'whoami']),
    ).toThrow('Unsafe pnpm argument');
  });
});
