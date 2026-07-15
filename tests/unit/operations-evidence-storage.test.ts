import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { storeLocalEvidence } from '@/modules/operations/infrastructure/local-evidence-storage';
import { LocalStorageAdapter } from '@/modules/storage';

const evidenceRoot = path.join(
  process.cwd(),
  '.local-uploads',
  'installation-evidence',
);

async function files(): Promise<string[]> {
  try {
    return (await readdir(evidenceRoot, { recursive: true }))
      .filter((entry) => entry !== '.tmp')
      .sort();
  } catch {
    return [];
  }
}

describe('local installation evidence storage', () => {
  it('removes its staged file when database persistence fails', async () => {
    const before = await files();
    await expect(
      storeLocalEvidence(
        {
          filename: 'evidence.png',
          contentType: 'image/png',
          contentBase64: 'iVBORw0KGgo=',
        },
        async () => {
          throw new Error('simulated database failure');
        },
        async () => undefined,
      ),
    ).rejects.toThrow('simulated database failure');
    await expect(files()).resolves.toEqual(before);
  });

  it('rejects traversal-style filenames before writing', async () => {
    await expect(
      storeLocalEvidence(
        {
          filename: '../evidence.png',
          contentType: 'image/png',
          contentBase64: 'iVBORw0KGgo=',
        },
        async () => ({ id: 'unused' }),
        async () => undefined,
      ),
    ).rejects.toThrow('Invalid filename');
  });

  it('keeps local storage disabled in production', async () => {
    const storage = new LocalStorageAdapter(undefined, 'production');
    await expect(
      storage.upload({
        filename: 'evidence.png',
        contentType: 'image/png',
        contentBase64: 'iVBORw0KGgo=',
      }),
    ).rejects.toThrow('disabled in production');
  });
});
