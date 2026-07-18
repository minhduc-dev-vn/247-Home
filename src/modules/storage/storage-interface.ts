export const evidenceMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type EvidenceMimeType = (typeof evidenceMimeTypes)[number];

export type StorageUploadInput = {
  filename: string;
  contentType: EvidenceMimeType;
  contentBase64: string;
  purpose?: 'installation' | 'warranty';
};

export type StoredPrivateObject = {
  storageKey: string;
  byteSize: number;
  contentType: EvidenceMimeType;
  checksumSha256: string;
};

export interface PrivateObjectStorage {
  upload(input: StorageUploadInput): Promise<StoredPrivateObject>;
  delete(storageKey: string): Promise<void>;
  getPrivateUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  exists(storageKey: string): Promise<boolean>;
  download(storageKey: string): Promise<Buffer | null>;
}

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

export class StorageProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StorageProviderError';
  }
}

export async function uploadAndPersist<T>(
  storage: PrivateObjectStorage,
  input: StorageUploadInput,
  persist: (uploaded: StoredPrivateObject) => Promise<T>,
): Promise<T> {
  const uploaded = await storage.upload(input);
  try {
    return await persist(uploaded);
  } catch (persistenceError: unknown) {
    try {
      await storage.delete(uploaded.storageKey);
    } catch (cleanupError: unknown) {
      throw new AggregateError(
        [persistenceError, cleanupError],
        'Evidence persistence failed and uploaded-object cleanup also failed.',
      );
    }
    throw persistenceError;
  }
}
