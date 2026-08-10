import { afterEach, describe, expect, it, vi } from 'vitest';

const readFile = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile,
}));

import { LocalStorageAdapter } from '@/modules/storage';

const storageKey =
  'installation-evidence/11111111-1111-4111-8111-111111111111.png';

function ioError(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(`simulated ${code}`);
  error.code = code;
  return error;
}

describe('LocalStorageAdapter.download error semantics', () => {
  const storage = new LocalStorageAdapter(undefined, 'test');

  afterEach(() => vi.clearAllMocks());

  it('returns null when the object does not exist', async () => {
    readFile.mockRejectedValue(ioError('ENOENT'));

    await expect(storage.download(storageKey)).resolves.toBeNull();
  });

  it('rethrows a permission failure instead of reporting a missing object', async () => {
    readFile.mockRejectedValue(ioError('EACCES'));

    await expect(storage.download(storageKey)).rejects.toThrow(
      'simulated EACCES',
    );
  });

  it('rethrows an unreadable directory instead of reporting a missing object', async () => {
    readFile.mockRejectedValue(ioError('EISDIR'));

    await expect(storage.download(storageKey)).rejects.toThrow(
      'simulated EISDIR',
    );
  });

  it('surfaces an oversized stored object as a storage failure', async () => {
    readFile.mockResolvedValue(Buffer.alloc(5 * 1024 * 1024 + 1));

    await expect(storage.download(storageKey)).rejects.toThrow('oversized');
  });

  it('rejects an invalid storage key before touching the filesystem', async () => {
    await expect(storage.download('../../etc/passwd')).rejects.toThrow(
      'Invalid storage key.',
    );
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns the stored content when it is readable and within the limit', async () => {
    readFile.mockResolvedValue(Buffer.from('evidence'));

    await expect(storage.download(storageKey)).resolves.toEqual(
      Buffer.from('evidence'),
    );
  });
});
