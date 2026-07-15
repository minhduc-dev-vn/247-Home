import { z } from 'zod';

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  APP_ORIGIN: z.string().url().optional(),
  TRUST_PROXY_HEADERS: z.enum(['true', 'false']).default('false'),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse({
    DATABASE_URL: environment.DATABASE_URL,
    NEXTAUTH_SECRET: environment.NEXTAUTH_SECRET,
    NEXTAUTH_URL: environment.NEXTAUTH_URL,
    APP_ORIGIN: environment.APP_ORIGIN,
    TRUST_PROXY_HEADERS: environment.TRUST_PROXY_HEADERS,
  });
}

let serverEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  serverEnvironment ??= parseServerEnvironment(process.env);
  return serverEnvironment;
}
