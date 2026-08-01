import { z } from 'zod';

import { LocalStorageAdapter } from '@/modules/storage/local-storage-adapter';
import { S3ObjectStorageAdapter } from '@/modules/storage/object-storage-adapter';
import {
  StorageConfigurationError,
  type PrivateObjectStorage,
} from '@/modules/storage/storage-interface';

const s3ConfigurationSchema = z
  .object({
    STORAGE_BUCKET: z.string().trim().min(3).max(255),
    STORAGE_REGION: z.string().trim().min(1).max(100),
    STORAGE_ENDPOINT: z.string().url().optional(),
    STORAGE_ACCESS_KEY: z.string().min(1).optional(),
    STORAGE_SECRET_KEY: z.string().min(1).optional(),
    STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  })
  .superRefine((configuration, context) => {
    const hasAccessKey = configuration.STORAGE_ACCESS_KEY !== undefined;
    const hasSecretKey = configuration.STORAGE_SECRET_KEY !== undefined;
    if (hasAccessKey !== hasSecretKey)
      context.addIssue({
        code: 'custom',
        message: 'Static storage credentials must be provided together.',
        path: ['STORAGE_ACCESS_KEY'],
      });
    if (configuration.STORAGE_ENDPOINT !== undefined && !hasAccessKey)
      context.addIssue({
        code: 'custom',
        message: 'A custom S3 endpoint requires explicit credentials.',
        path: ['STORAGE_ENDPOINT'],
      });
  });

function createS3Storage(
  environment: Record<string, string | undefined>,
  bucket: string | undefined,
): PrivateObjectStorage {
  const parsed = s3ConfigurationSchema.safeParse({
    ...environment,
    STORAGE_BUCKET: bucket,
  });
  if (!parsed.success)
    throw new StorageConfigurationError(
      `Missing or invalid object storage configuration: ${parsed.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}.`,
    );

  return new S3ObjectStorageAdapter({
    bucket: parsed.data.STORAGE_BUCKET,
    region: parsed.data.STORAGE_REGION,
    endpoint: parsed.data.STORAGE_ENDPOINT,
    credentials:
      parsed.data.STORAGE_ACCESS_KEY && parsed.data.STORAGE_SECRET_KEY
        ? {
            accessKeyId: parsed.data.STORAGE_ACCESS_KEY,
            secretAccessKey: parsed.data.STORAGE_SECRET_KEY,
          }
        : undefined,
    forcePathStyle: parsed.data.STORAGE_FORCE_PATH_STYLE === 'true',
  });
}

export function createEvidenceStorage(
  environment: Record<string, string | undefined> = process.env,
): PrivateObjectStorage {
  const provider =
    environment.EVIDENCE_STORAGE_PROVIDER ??
    (environment.NODE_ENV === 'production' ? undefined : 'local');

  if (provider === 'local') {
    if (environment.NODE_ENV === 'production')
      throw new StorageConfigurationError(
        'Local evidence storage is disabled in production.',
      );
    return new LocalStorageAdapter(undefined, environment.NODE_ENV);
  }

  if (provider !== 's3')
    throw new StorageConfigurationError(
      'EVIDENCE_STORAGE_PROVIDER must be s3 in production.',
    );

  return createS3Storage(environment, environment.STORAGE_BUCKET);
}

export function createCatalogImageStorage(
  environment: Record<string, string | undefined> = process.env,
): PrivateObjectStorage {
  const provider =
    environment.CATALOG_IMAGE_STORAGE_PROVIDER ??
    (environment.NODE_ENV === 'production' ? undefined : 'local');

  if (provider === 'local') {
    if (environment.NODE_ENV === 'production')
      throw new StorageConfigurationError(
        'Local catalog image storage is disabled in production.',
      );
    return new LocalStorageAdapter(undefined, environment.NODE_ENV);
  }

  if (provider !== 's3')
    throw new StorageConfigurationError(
      'CATALOG_IMAGE_STORAGE_PROVIDER must be s3 in production.',
    );

  return createS3Storage(
    environment,
    environment.CATALOG_IMAGE_STORAGE_BUCKET ?? environment.STORAGE_BUCKET,
  );
}

let evidenceStorage: PrivateObjectStorage | undefined;
let catalogImageStorage: PrivateObjectStorage | undefined;

export function getEvidenceStorage(): PrivateObjectStorage {
  evidenceStorage ??= createEvidenceStorage();
  return evidenceStorage;
}

export function getCatalogImageStorage(): PrivateObjectStorage {
  catalogImageStorage ??= createCatalogImageStorage();
  return catalogImageStorage;
}

export function resetEvidenceStorageForTests(): void {
  if (process.env.NODE_ENV !== 'test')
    throw new StorageConfigurationError(
      'Storage singleton reset is restricted to tests.',
    );
  evidenceStorage = undefined;
}

export function resetCatalogImageStorageForTests(): void {
  if (process.env.NODE_ENV !== 'test')
    throw new StorageConfigurationError(
      'Storage singleton reset is restricted to tests.',
    );
  catalogImageStorage = undefined;
}
