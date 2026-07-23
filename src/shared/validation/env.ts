import { z } from 'zod';

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  APP_ORIGIN: z.string().url().optional(),
  TRUST_PROXY_HEADERS: z.enum(['true', 'false']).default('false'),
  TRUSTED_PROXY_PROVIDER: z.enum(['cloudfront']).optional(),
  RATE_LIMIT_BACKEND: z.enum(['memory', 'waf']).default('memory'),
  AUTH_SECURE_COOKIES: z.enum(['true', 'false']).optional(),
});

export type ServerEnvironment = Omit<
  z.infer<typeof serverEnvironmentSchema>,
  'AUTH_SECURE_COOKIES'
> & { AUTH_SECURE_COOKIES: boolean };

function isLoopbackUrl(value: string): boolean {
  const hostname = new URL(value).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  const parsed = serverEnvironmentSchema.parse({
    DATABASE_URL: environment.DATABASE_URL,
    NEXTAUTH_SECRET: environment.NEXTAUTH_SECRET,
    NEXTAUTH_URL: environment.NEXTAUTH_URL,
    APP_ORIGIN: environment.APP_ORIGIN,
    TRUST_PROXY_HEADERS: environment.TRUST_PROXY_HEADERS,
    TRUSTED_PROXY_PROVIDER: environment.TRUSTED_PROXY_PROVIDER,
    RATE_LIMIT_BACKEND: environment.RATE_LIMIT_BACKEND,
    AUTH_SECURE_COOKIES: environment.AUTH_SECURE_COOKIES,
  });
  const secureCookies =
    parsed.AUTH_SECURE_COOKIES === undefined
      ? environment.NODE_ENV === 'production'
      : parsed.AUTH_SECURE_COOKIES === 'true';
  if (
    !secureCookies &&
    environment.NODE_ENV === 'production' &&
    (environment.LOCAL_DEMO !== 'true' ||
      !isLoopbackUrl(parsed.NEXTAUTH_URL) ||
      (parsed.APP_ORIGIN !== undefined && !isLoopbackUrl(parsed.APP_ORIGIN)))
  )
    throw new Error(
      'Insecure Auth cookies are restricted to the loopback local demo runtime.',
    );
  if (
    environment.NODE_ENV === 'production' &&
    environment.NEXT_PHASE !== 'phase-production-build' &&
    environment.LOCAL_DEMO !== 'true' &&
    (parsed.RATE_LIMIT_BACKEND !== 'waf' ||
      parsed.TRUST_PROXY_HEADERS !== 'true' ||
      parsed.TRUSTED_PROXY_PROVIDER !== 'cloudfront')
  )
    throw new Error(
      'Production requires the CloudFront/WAF trusted ingress contract.',
    );
  const { AUTH_SECURE_COOKIES: _rawSecureCookies, ...serverEnvironment } =
    parsed;
  return { ...serverEnvironment, AUTH_SECURE_COOKIES: secureCookies };
}

let serverEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  serverEnvironment ??= parseServerEnvironment(process.env);
  return serverEnvironment;
}
