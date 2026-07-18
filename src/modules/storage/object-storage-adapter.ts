import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  assertEvidenceStorageKey,
  createEvidenceStorageKey,
  maximumEvidenceBytes,
  validateEvidenceUpload,
} from '@/modules/storage/evidence-validation';
import {
  StorageConfigurationError,
  StorageProviderError,
  type PrivateObjectStorage,
  type StorageUploadInput,
  type StoredPrivateObject,
} from '@/modules/storage/storage-interface';

export type S3ObjectStorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  forcePathStyle: boolean;
};

type Presign = (
  client: S3Client,
  command: GetObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

function providerError(error: unknown): StorageProviderError {
  return new StorageProviderError('Private object storage request failed.', {
    cause: error,
  });
}

export class S3ObjectStorageAdapter implements PrivateObjectStorage {
  private readonly client: S3Client;

  constructor(
    private readonly config: S3ObjectStorageConfig,
    client?: S3Client,
    private readonly presign: Presign = getSignedUrl,
  ) {
    this.client =
      client ??
      new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: config.credentials,
      });
  }

  async upload(input: StorageUploadInput): Promise<StoredPrivateObject> {
    const validated = validateEvidenceUpload(input);
    const storageKey = createEvidenceStorageKey(
      validated.extension,
      input.purpose,
    );
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: storageKey,
          Body: validated.content,
          ContentLength: validated.content.length,
          ContentType: validated.contentType,
          ChecksumSHA256: Buffer.from(validated.checksumSha256, 'hex').toString(
            'base64',
          ),
          Metadata: { sha256: validated.checksumSha256 },
        }),
      );
      return {
        storageKey,
        byteSize: validated.content.length,
        contentType: validated.contentType,
        checksumSha256: validated.checksumSha256,
      };
    } catch (error: unknown) {
      throw providerError(error);
    }
  }

  async delete(storageKey: string): Promise<void> {
    const safeKey = assertEvidenceStorageKey(storageKey);
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: safeKey }),
      );
    } catch (error: unknown) {
      throw providerError(error);
    }
  }

  async getPrivateUrl(
    storageKey: string,
    expiresInSeconds = 60,
  ): Promise<string> {
    const safeKey = assertEvidenceStorageKey(storageKey);
    if (expiresInSeconds < 1 || expiresInSeconds > 900)
      throw new StorageConfigurationError('Invalid private URL lifetime.');
    try {
      return await this.presign(
        this.client,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: safeKey }),
        { expiresIn: expiresInSeconds },
      );
    } catch (error: unknown) {
      throw providerError(error);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const safeKey = assertEvidenceStorageKey(storageKey);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: safeKey }),
      );
      return true;
    } catch (error: unknown) {
      if (
        error instanceof NotFound ||
        (typeof error === 'object' &&
          error !== null &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404)
      )
        return false;
      throw providerError(error);
    }
  }

  async download(storageKey: string): Promise<Buffer | null> {
    const safeKey = assertEvidenceStorageKey(storageKey);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: safeKey }),
      );
      if (!response.Body) return null;
      if (
        response.ContentLength !== undefined &&
        response.ContentLength > maximumEvidenceBytes
      )
        throw new StorageProviderError('Stored evidence is oversized.');
      const content = Buffer.from(await response.Body.transformToByteArray());
      if (content.length > maximumEvidenceBytes)
        throw new StorageProviderError('Stored evidence is oversized.');
      return content;
    } catch (error: unknown) {
      if (
        error instanceof NotFound ||
        (typeof error === 'object' &&
          error !== null &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404)
      )
        return null;
      throw providerError(error);
    }
  }
}
