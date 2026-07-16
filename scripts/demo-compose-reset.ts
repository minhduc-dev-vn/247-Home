import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { runExecutable, runPnpm } from './demo-runtime';

function composeProject(): string {
  return path.basename(process.cwd()).toLowerCase();
}

async function findAppContainer(): Promise<string | undefined> {
  const project = composeProject();
  return new Promise<string | undefined>((resolve, reject) => {
    execFile(
      'docker',
      [
        'ps',
        '--filter',
        `label=com.docker.compose.project=${project}`,
        '--filter',
        'label=com.docker.compose.service=app',
        '--format',
        '{{.ID}}',
      ],
      { timeout: 15_000 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim().split(/\s+/).filter(Boolean)[0]);
      },
    );
  });
}

async function loadDemoEnvironment(): Promise<void> {
  const contents = await readFile('.env.demo.example', 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    if (!/^[A-Z][A-Z0-9_]*$/.test(key))
      throw new Error(`Invalid demo environment key: ${key}.`);
    process.env[key] = line.slice(separator + 1);
  }
  process.env.EVIDENCE_STORAGE_PROVIDER = 's3';
  process.env.STORAGE_ENDPOINT = `http://127.0.0.1:${process.env.MINIO_API_PORT ?? '9000'}`;
  process.env.STORAGE_FORCE_PATH_STYLE = 'true';
}

async function main() {
  const appContainer = await findAppContainer();
  if (!appContainer)
    throw new Error('Start the local demo with pnpm demo:up before reset.');
  await loadDemoEnvironment();
  await runPnpm(['demo:reset:database']);
  await runExecutable('docker', ['restart', appContainer], {
    timeoutMs: 60_000,
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:3000/api/ready');
      if (response.ok) return;
    } catch {
      // The production process can briefly retain a stale pool during reset.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('Local demo application did not become ready after reset.');
}

void main();
