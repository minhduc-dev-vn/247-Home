import { spawn } from 'node:child_process';

const localDatabaseHosts = new Set(['127.0.0.1', 'localhost', 'db']);
const localDatabaseNames = new Set(['home247', 'home247_demo']);

export type DemoDatabaseTarget = {
  database: string;
  host: string;
};

export function assertLocalDemoRuntime(
  environment: Record<string, string | undefined>,
  options: { destructive: boolean },
): DemoDatabaseTarget {
  if (environment.LOCAL_DEMO !== 'true')
    throw new Error('LOCAL_DEMO=true is required for demo tooling.');
  if (environment.NODE_ENV === 'production')
    throw new Error('Demo tooling is disabled when NODE_ENV=production.');
  if (options.destructive && environment.DEMO_RESET_ALLOWED !== 'true')
    throw new Error('DEMO_RESET_ALLOWED=true is required for demo reset.');

  const rawDatabaseUrl = environment.DATABASE_URL;
  if (!rawDatabaseUrl) throw new Error('DATABASE_URL is required.');
  const databaseUrl = new URL(rawDatabaseUrl);
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol))
    throw new Error('Demo tooling requires PostgreSQL.');

  const database = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (
    !localDatabaseHosts.has(databaseUrl.hostname) ||
    !localDatabaseNames.has(database)
  )
    throw new Error(
      'Demo tooling only accepts the local db/localhost host and an approved demo database name.',
    );

  return { database, host: databaseUrl.hostname };
}

export async function runPnpm(arguments_: string[]): Promise<void> {
  if (process.platform === 'win32') {
    const command = buildWindowsPnpmCommand(arguments_);
    await runExecutable(process.env.ComSpec ?? 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      command,
    ]);
    return;
  }
  await runExecutable('pnpm', arguments_);
}

export function buildWindowsPnpmCommand(arguments_: string[]): string {
  if (!arguments_.every((value) => /^[A-Za-z0-9:./@_-]+$/.test(value)))
    throw new Error('Unsafe pnpm argument rejected by demo tooling.');
  return ['pnpm', ...arguments_].join(' ');
}

export async function runExecutable(
  executable: string,
  arguments_: string[],
  options: { timeoutMs?: number } = {},
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const child = spawn(executable, arguments_, {
      env: process.env,
      stdio: 'inherit',
    });
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill();
          reject(
            new Error(
              `${executable} ${arguments_.join(' ')} exceeded ${options.timeoutMs} ms.`,
            ),
          );
        }, options.timeoutMs)
      : undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      callback();
    };
    child.once('error', (error) => finish(() => reject(error)));
    child.once('exit', (code, signal) => {
      finish(() => {
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `${executable} ${arguments_.join(' ')} failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}.`,
            ),
          );
      });
    });
  });
}
