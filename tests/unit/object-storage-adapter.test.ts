import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';

import {
  maximumEvidenceBytes,
  S3ObjectStorageAdapter,
  uploadAndPersist,
  type PrivateObjectStorage,
} from '@/modules/storage';

const pngBase64 = 'iVBORw0KGgo=';
const config = {
  bucket: 'private-evidence',
  region: 'us-east-1',
  endpoint: 'https://objects.staging.example',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  forcePathStyle: true,
};

describe('S3-compatible private object storage', () => {
  it('uploads a generated private key with checksum metadata', async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = new S3ObjectStorageAdapter(config, {
      send,
    } as unknown as S3Client);

    const uploaded = await storage.upload({
      filename: 'completion.png',
      contentType: 'image/png',
      contentBase64: pngBase64,
    });

    expect(uploaded.storageKey).toMatch(
      /^installation-evidence\/[0-9a-f-]{36}\.png$/,
    );
    expect(uploaded.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: config.bucket,
      Key: uploaded.storageKey,
      ContentType: 'image/png',
      ContentLength: 8,
      Metadata: { sha256: uploaded.checksumSha256 },
    });
    expect((command as PutObjectCommand).input.ACL).toBeUndefined();
  });

  it('creates a short-lived SigV4 private URL without exposing the secret', async () => {
    const storage = new S3ObjectStorageAdapter(config);
    const key =
      'installation-evidence/123e4567-e89b-42d3-a456-426614174000.png';
    const privateUrl = await storage.getPrivateUrl(key, 90);
    const url = new URL(privateUrl);

    expect(url.searchParams.get('X-Amz-Expires')).toBe('90');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(privateUrl).not.toContain(config.secretAccessKey);
  });

  it('rejects extension mismatch and oversized content before provider I/O', async () => {
    const send = vi.fn();
    const storage = new S3ObjectStorageAdapter(config, {
      send,
    } as unknown as S3Client);

    await expect(
      storage.upload({
        filename: 'completion.jpg',
        contentType: 'image/png',
        contentBase64: pngBase64,
      }),
    ).rejects.toThrow('extension');

    const oversized = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(maximumEvidenceBytes),
    ]).toString('base64');
    await expect(
      storage.upload({
        filename: 'completion.png',
        contentType: 'image/png',
        contentBase64: oversized,
      }),
    ).rejects.toThrow('size');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports both persistence and orphan cleanup failures', async () => {
    const storage: PrivateObjectStorage = {
      upload: vi.fn().mockResolvedValue({
        storageKey:
          'installation-evidence/123e4567-e89b-42d3-a456-426614174000.png',
        byteSize: 8,
        contentType: 'image/png',
        checksumSha256: 'a'.repeat(64),
      }),
      delete: vi.fn().mockRejectedValue(new Error('provider delete failed')),
      getPrivateUrl: vi.fn(),
      exists: vi.fn(),
      download: vi.fn(),
    };

    const error = await uploadAndPersist(
      storage,
      {
        filename: 'completion.png',
        contentType: 'image/png',
        contentBase64: pngBase64,
      },
      async () => {
        throw new Error('database failed');
      },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'database failed' }),
        expect.objectContaining({ message: 'provider delete failed' }),
      ]),
    );
  });

  it('downloads private bytes through the authenticated provider client', async () => {
    const send = vi.fn().mockResolvedValue({
      Body: {
        transformToByteArray: async () => Uint8Array.from([1, 2, 3]),
      },
    });
    const storage = new S3ObjectStorageAdapter(config, {
      send,
    } as unknown as S3Client);
    const content = await storage.download(
      'installation-evidence/123e4567-e89b-42d3-a456-426614174000.png',
    );
    expect(content).toEqual(Buffer.from([1, 2, 3]));
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });
});
