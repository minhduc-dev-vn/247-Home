import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertEvidenceStorageKey,
  createEvidenceStorageKey,
  maximumEvidenceBytes,
  validateEvidenceUpload,
} from '@/modules/storage/evidence-validation';
import {
  StorageConfigurationError,
  type PrivateObjectStorage,
  type StorageUploadInput,
  type StoredPrivateObject,
} from '@/modules/storage/storage-interface';

export class LocalStorageAdapter implements PrivateObjectStorage {
  constructor(
    private readonly root = path.join(process.cwd(), '.local-uploads'),
    private readonly environment: string | undefined = process.env.NODE_ENV,
  ) {}

  private assertEnabled() {
    if (this.environment === 'production')
      throw new StorageConfigurationError(
        'Local evidence storage is disabled in production.',
      );
  }

  private resolve(storageKey: string): string {
    const safeKey = assertEvidenceStorageKey(storageKey);
    const resolvedRoot = path.resolve(this.root);
    const resolved = path.resolve(this.root, ...safeKey.split('/'));
    if (!resolved.startsWith(`${resolvedRoot}${path.sep}`))
      throw new StorageConfigurationError('Invalid local storage path.');
    return resolved;
  }

  async upload(input: StorageUploadInput): Promise<StoredPrivateObject> {
    this.assertEnabled();
    const validated = validateEvidenceUpload(input);
    const storageKey = createEvidenceStorageKey(
      validated.extension,
      input.purpose,
    );
    const destination = this.resolve(storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, validated.content, { flag: 'wx' });
    return {
      storageKey,
      byteSize: validated.content.length,
      contentType: validated.contentType,
      checksumSha256: validated.checksumSha256,
    };
  }

  async delete(storageKey: string): Promise<void> {
    this.assertEnabled();
    await rm(this.resolve(storageKey), { force: true });
  }

  async getPrivateUrl(
    storageKey: string,
    expiresInSeconds = 60,
  ): Promise<string> {
    this.assertEnabled();
    const safeKey = assertEvidenceStorageKey(storageKey);
    if (expiresInSeconds < 1 || expiresInSeconds > 900)
      throw new StorageConfigurationError('Invalid private URL lifetime.');
    return `local-private://evidence/${encodeURIComponent(safeKey)}?expires=${expiresInSeconds}`;
  }

  async exists(storageKey: string): Promise<boolean> {
    this.assertEnabled();
    try {
      await access(this.resolve(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async download(storageKey: string): Promise<Buffer | null> {
    this.assertEnabled();
    try {
      const content = await readFile(this.resolve(storageKey));
      if (content.length > maximumEvidenceBytes)
        throw new StorageConfigurationError('Stored evidence is oversized.');
      return content;
    } catch {
      return null;
    }
  }
}
