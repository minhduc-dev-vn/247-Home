import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export type RateLimitProbeScope = 'auth' | 'mutation';
export type RateLimitProbeAuthEndpoint =
  'forgot-password' | 'login' | 'register';

export type RateLimitProbeConfig = {
  baseUrl: URL;
  originUrl?: URL;
  scope: RateLimitProbeScope;
  authEndpoint: RateLimitProbeAuthEndpoint;
  requestCount: number;
  minimum429Attempt: number;
};

export type RateLimitProbeResult = {
  check: 'staging-shared-rate-limit';
  scope: RateLimitProbeScope;
  authEndpoint?: RateLimitProbeAuthEndpoint;
  requestsSent: number;
  limitedAt: number;
  retryAfterSeconds: string;
  statusCounts: Record<string, number>;
  spoofedForwardingHeadersSent: true;
  directOrigin: 'not-checked' | 'http-403' | 'network-denied';
  status: 'PASS';
};

type FetchLike = typeof fetch;

const defaultRequestCount = 110;
const defaultMinimum429Attempt = 10;
const maximumRequestCount = 1_000;

function parseHttpsUrl(value: string | undefined, variableName: string): URL {
  if (!value) throw new Error(`${variableName} must be an HTTPS URL.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be an HTTPS URL.`);
  }
  if (url.protocol !== 'https:')
    throw new Error(`${variableName} must be an HTTPS URL.`);
  return url;
}

function parseBoundedInteger(
  value: string | undefined,
  variableName: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(
      `${variableName} must be an integer between ${minimum} and ${maximum}.`,
    );
  return parsed;
}

function parseScope(value: string | undefined): RateLimitProbeScope {
  if (value === undefined || value === 'auth') return 'auth';
  if (value === 'mutation') return 'mutation';
  throw new Error('RATE_LIMIT_PROBE_SCOPE must be auth or mutation.');
}

function parseAuthEndpoint(
  value: string | undefined,
): RateLimitProbeAuthEndpoint {
  if (value === undefined || value === 'forgot-password')
    return 'forgot-password';
  if (value === 'login' || value === 'register') return value;
  throw new Error(
    'RATE_LIMIT_PROBE_AUTH_ENDPOINT must be forgot-password, login, or register.',
  );
}

export function parseRateLimitProbeConfig(
  environment: Record<string, string | undefined> = process.env,
): RateLimitProbeConfig {
  const baseUrl = parseHttpsUrl(
    environment.STAGING_BASE_URL,
    'STAGING_BASE_URL',
  );
  const originUrl = environment.STAGING_ORIGIN_URL
    ? parseHttpsUrl(environment.STAGING_ORIGIN_URL, 'STAGING_ORIGIN_URL')
    : undefined;
  if (originUrl?.origin === baseUrl.origin)
    throw new Error(
      'STAGING_ORIGIN_URL must not be the public staging origin.',
    );

  const requestCount = parseBoundedInteger(
    environment.RATE_LIMIT_PROBE_REQUESTS,
    'RATE_LIMIT_PROBE_REQUESTS',
    defaultRequestCount,
    2,
    maximumRequestCount,
  );
  const minimum429Attempt = parseBoundedInteger(
    environment.RATE_LIMIT_PROBE_MIN_429_AT,
    'RATE_LIMIT_PROBE_MIN_429_AT',
    defaultMinimum429Attempt,
    2,
    requestCount,
  );

  return {
    baseUrl,
    originUrl,
    scope: parseScope(environment.RATE_LIMIT_PROBE_SCOPE),
    authEndpoint: parseAuthEndpoint(environment.RATE_LIMIT_PROBE_AUTH_ENDPOINT),
    requestCount,
    minimum429Attempt,
  };
}

function requestForProbe(
  config: RateLimitProbeConfig,
  attempt: number,
  probeId: string,
): { endpoint: URL; init: RequestInit } {
  const spoofedAddress = `203.0.113.${(attempt % 200) + 1}`;
  const headers = new Headers({
    Origin: config.baseUrl.origin,
    'X-247-Client-Address': spoofedAddress,
    'X-Forwarded-For': `${spoofedAddress}, 198.51.100.1`,
  });

  if (config.scope === 'mutation') {
    headers.set('Content-Type', 'application/json');
    return {
      endpoint: new URL(
        '/api/v1/admin/orders/00000000-0000-0000-0000-000000000000/actions',
        config.baseUrl,
      ),
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'CONFIRM_PAYMENT', expectedVersion: 0 }),
        redirect: 'manual',
      },
    };
  }

  if (config.authEndpoint === 'login') {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    return {
      endpoint: new URL('/api/auth/callback/credentials', config.baseUrl),
      init: {
        method: 'POST',
        headers,
        body: 'email=rate-limit-probe%40example.invalid&password=not-a-real-password',
        redirect: 'manual',
      },
    };
  }

  headers.set('Content-Type', 'application/json');
  if (config.authEndpoint === 'register') {
    return {
      endpoint: new URL('/api/v1/auth/register', config.baseUrl),
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Rate limit probe',
          email: 'not-an-email',
          password: 'not-a-real-password',
        }),
        redirect: 'manual',
      },
    };
  }

  return {
    endpoint: new URL('/api/v1/auth/forgot-password', config.baseUrl),
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: `rate-limit-probe-${probeId}-${attempt}@example.invalid`,
      }),
      redirect: 'manual',
    },
  };
}

async function verifyDirectOrigin(
  originUrl: URL | undefined,
  fetchImplementation: FetchLike,
): Promise<RateLimitProbeResult['directOrigin']> {
  if (!originUrl) return 'not-checked';
  try {
    const response = await fetchImplementation(
      new URL('/api/health', originUrl),
      {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.status !== 403)
      throw new Error(
        `Direct origin returned HTTP ${response.status}; expected 403 or a network denial.`,
      );
    return 'http-403';
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('Direct origin returned HTTP')
    )
      throw error;
    return 'network-denied';
  }
}

export async function runRateLimitProbe(
  config: RateLimitProbeConfig,
  fetchImplementation: FetchLike = fetch,
): Promise<RateLimitProbeResult> {
  const probeId = randomUUID();
  const statusCounts = new Map<number, number>();
  let limitedAt: number | undefined;
  let retryAfterSeconds: string | undefined;

  for (let attempt = 1; attempt <= config.requestCount; attempt += 1) {
    const probeRequest = requestForProbe(config, attempt, probeId);
    const response = await fetchImplementation(
      probeRequest.endpoint,
      probeRequest.init,
    );
    statusCounts.set(
      response.status,
      (statusCounts.get(response.status) ?? 0) + 1,
    );

    if (response.status === 429) {
      if (attempt < config.minimum429Attempt)
        throw new Error(
          `Received HTTP 429 at request ${attempt}, before the configured minimum ${config.minimum429Attempt}.`,
        );
      const retryAfter = response.headers.get('retry-after');
      if (!retryAfter)
        throw new Error('The HTTP 429 response is missing Retry-After.');
      limitedAt = attempt;
      retryAfterSeconds = retryAfter;
      break;
    }
    if (response.status >= 500)
      throw new Error(`Rate-limit probe received HTTP ${response.status}.`);
  }

  if (limitedAt === undefined || retryAfterSeconds === undefined)
    throw new Error(
      `No rate-limit HTTP 429 response after ${config.requestCount} requests.`,
    );

  const directOrigin = await verifyDirectOrigin(
    config.originUrl,
    fetchImplementation,
  );
  return {
    check: 'staging-shared-rate-limit',
    scope: config.scope,
    ...(config.scope === 'auth' ? { authEndpoint: config.authEndpoint } : {}),
    requestsSent: limitedAt,
    limitedAt,
    retryAfterSeconds,
    statusCounts: Object.fromEntries(statusCounts),
    spoofedForwardingHeadersSent: true,
    directOrigin,
    status: 'PASS',
  };
}

async function main(): Promise<void> {
  const result = await runRateLimitProbe(parseRateLimitProbeConfig());
  console.log(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Rate probe failed');
    process.exitCode = 1;
  });
}
