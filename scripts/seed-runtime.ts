const LOCAL_DEMO_PASSWORD = 'LocalDemoOnly-247Home';
const STAGING_CONFIRMATION = '247HOME_RENDER_STAGING';

export type SeedRuntime = {
  markerId: 'local-demo' | 'render-staging-demo';
  markerLabel: string;
  password: string;
  requestIdPrefix: 'local-demo' | 'render-staging-demo';
};

function databaseHostname(databaseUrl: string | undefined): string {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for seed.');

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:')
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');

  return parsed.hostname.toLowerCase();
}

function isLocalDatabase(hostname: string, localDemo: string | undefined) {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  )
    return true;

  return localDemo === 'true' && (hostname === 'db' || hostname === 'postgres');
}

function assertStrongStagingPassword(password: string | undefined): string {
  if (!password || password.length < 20)
    throw new Error(
      'STAGING_DEMO_PASSWORD must contain at least 20 characters.',
    );
  if (password === LOCAL_DEMO_PASSWORD)
    throw new Error(
      'The public local demo password cannot be used in staging.',
    );
  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  )
    throw new Error(
      'STAGING_DEMO_PASSWORD must include lowercase, uppercase, number and symbol.',
    );

  return password;
}

export function resolveSeedRuntime(
  environment: Record<string, string | undefined>,
): SeedRuntime {
  const hostname = databaseHostname(environment.DATABASE_URL);

  if (environment.SEED_TARGET === 'staging') {
    if (!hostname.endsWith('.render.com'))
      throw new Error(
        'Staging seed is restricted to a Render PostgreSQL host.',
      );
    if (environment.STAGING_SEED_CONFIRM !== STAGING_CONFIRMATION)
      throw new Error(
        `Set STAGING_SEED_CONFIRM=${STAGING_CONFIRMATION} to confirm the staging target.`,
      );

    return {
      markerId: 'render-staging-demo',
      markerLabel: '247 Home Render staging demo marker',
      password: assertStrongStagingPassword(environment.STAGING_DEMO_PASSWORD),
      requestIdPrefix: 'render-staging-demo',
    };
  }

  if (environment.SEED_TARGET !== undefined)
    throw new Error(`Unsupported SEED_TARGET: ${environment.SEED_TARGET}.`);
  if (environment.NODE_ENV === 'production')
    throw new Error(
      'Seed data is only available in local development or explicit staging.',
    );
  if (!isLocalDatabase(hostname, environment.LOCAL_DEMO))
    throw new Error(
      'Local seed is restricted to a local database. Use the explicit staging seed contract for Render.',
    );

  return {
    markerId: 'local-demo',
    markerLabel: '247 Home local demo marker',
    password: LOCAL_DEMO_PASSWORD,
    requestIdPrefix: 'local-demo',
  };
}
