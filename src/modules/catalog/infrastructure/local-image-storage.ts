import {
  StorageConfigurationError,
  StorageProviderError,
  StorageValidationError,
  type EvidenceMimeType,
} from '@/modules/storage';

import { createProductImageStorage } from './product-image-storage';

type LocalProductImageInput = {
  filename: string;
  contentType: EvidenceMimeType;
  contentBase64: string;
};

// Compatibility helpers for local development and tests. Runtime routes use
// product-image-storage so production cannot accidentally select this adapter.
export class LocalImageStorageError extends Error {}

function localProductImageStorage() {
  return createProductImageStorage({
    ...process.env,
    CATALOG_IMAGE_STORAGE_PROVIDER: 'local',
  });
}

function asLocalImageStorageError(error: unknown): never {
  if (
    error instanceof StorageConfigurationError ||
    error instanceof StorageProviderError ||
    error instanceof StorageValidationError
  )
    throw new LocalImageStorageError(error.message);
  throw error;
}

export async function saveLocalProductImage(input: LocalProductImageInput) {
  try {
    return await localProductImageStorage().upload(input);
  } catch (error: unknown) {
    return asLocalImageStorageError(error);
  }
}

export async function readLocalProductImage(
  storageKey: string,
): Promise<Buffer | null> {
  try {
    return await localProductImageStorage().download(storageKey);
  } catch (error: unknown) {
    return asLocalImageStorageError(error);
  }
}

export async function removeLocalProductImage(
  storageKey: string,
): Promise<void> {
  try {
    await localProductImageStorage().delete(storageKey);
  } catch (error: unknown) {
    return asLocalImageStorageError(error);
  }
}
