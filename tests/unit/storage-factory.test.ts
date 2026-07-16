import { describe, expect, it } from 'vitest';

import {
  createEvidenceStorage,
  LocalStorageAdapter,
  S3ObjectStorageAdapter,
} from '@/modules/storage';

describe('evidence storage factory', () => {
  it('uses local storage only outside production', () => {
    expect(createEvidenceStorage({ NODE_ENV: 'test' })).toBeInstanceOf(
      LocalStorageAdapter,
    );
    expect(() =>
      createEvidenceStorage({
        NODE_ENV: 'production',
        EVIDENCE_STORAGE_PROVIDER: 'local',
      }),
    ).toThrow('disabled in production');
  });

  it('fails closed when production storage is not configured', () => {
    expect(() => createEvidenceStorage({ NODE_ENV: 'production' })).toThrow(
      'must be s3 in production',
    );
  });

  it('creates an S3-compatible provider from the staging contract', () => {
    expect(
      createEvidenceStorage({
        NODE_ENV: 'production',
        EVIDENCE_STORAGE_PROVIDER: 's3',
        STORAGE_BUCKET: 'private-evidence',
        STORAGE_REGION: 'us-east-1',
        STORAGE_ENDPOINT: 'https://objects.staging.example',
        STORAGE_ACCESS_KEY: 'access-key',
        STORAGE_SECRET_KEY: 'secret-key',
        STORAGE_FORCE_PATH_STYLE: 'true',
      }),
    ).toBeInstanceOf(S3ObjectStorageAdapter);
  });

  it('uses the AWS SDK credential provider chain when static keys are absent', () => {
    expect(
      createEvidenceStorage({
        NODE_ENV: 'production',
        EVIDENCE_STORAGE_PROVIDER: 's3',
        STORAGE_BUCKET: 'private-evidence',
        STORAGE_REGION: 'ap-southeast-1',
      }),
    ).toBeInstanceOf(S3ObjectStorageAdapter);
  });

  it('rejects partial credentials and unsigned custom endpoints', () => {
    expect(() =>
      createEvidenceStorage({
        NODE_ENV: 'production',
        EVIDENCE_STORAGE_PROVIDER: 's3',
        STORAGE_BUCKET: 'private-evidence',
        STORAGE_REGION: 'ap-southeast-1',
        STORAGE_ACCESS_KEY: 'access-key-only',
      }),
    ).toThrow('STORAGE_ACCESS_KEY');

    expect(() =>
      createEvidenceStorage({
        NODE_ENV: 'production',
        EVIDENCE_STORAGE_PROVIDER: 's3',
        STORAGE_BUCKET: 'private-evidence',
        STORAGE_REGION: 'ap-southeast-1',
        STORAGE_ENDPOINT: 'https://objects.staging.example',
      }),
    ).toThrow('STORAGE_ENDPOINT');
  });
});
