import { describe, expect, it } from 'vitest';

import { resolveSeedRuntime } from '../../scripts/seed-runtime';

const strongPassword = 'Render-Staging-247Home-Only!9';

describe('seed runtime', () => {
  it('allows the fixed local fixture only for a local database', () => {
    expect(
      resolveSeedRuntime({
        DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:5433/home247',
      }),
    ).toMatchObject({
      markerId: 'local-demo',
      password: 'LocalDemoOnly-247Home',
    });
  });

  it('blocks the local fixture from a remote database', () => {
    expect(() =>
      resolveSeedRuntime({
        DATABASE_URL: 'postgresql://demo:demo@database.example.com/home247',
      }),
    ).toThrow('Local seed is restricted to a local database');
  });

  it('requires explicit confirmation for Render staging', () => {
    expect(() =>
      resolveSeedRuntime({
        DATABASE_URL:
          'postgresql://demo:demo@sample.singapore-postgres.render.com/home247',
        SEED_TARGET: 'staging',
        STAGING_DEMO_PASSWORD: strongPassword,
      }),
    ).toThrow('STAGING_SEED_CONFIRM');
  });

  it('rejects the public local password in staging', () => {
    expect(() =>
      resolveSeedRuntime({
        DATABASE_URL:
          'postgresql://demo:demo@sample.singapore-postgres.render.com/home247',
        SEED_TARGET: 'staging',
        STAGING_SEED_CONFIRM: '247HOME_RENDER_STAGING',
        STAGING_DEMO_PASSWORD: 'LocalDemoOnly-247Home',
      }),
    ).toThrow('public local demo password');
  });

  it('returns a secret-backed Render staging configuration', () => {
    expect(
      resolveSeedRuntime({
        DATABASE_URL:
          'postgresql://demo:demo@sample.singapore-postgres.render.com/home247',
        SEED_TARGET: 'staging',
        STAGING_SEED_CONFIRM: '247HOME_RENDER_STAGING',
        STAGING_DEMO_PASSWORD: strongPassword,
      }),
    ).toEqual({
      markerId: 'render-staging-demo',
      markerLabel: '247 Home Render staging demo marker',
      password: strongPassword,
      requestIdPrefix: 'render-staging-demo',
    });
  });
});
