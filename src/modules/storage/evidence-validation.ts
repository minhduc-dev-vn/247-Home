import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  StorageValidationError,
  type EvidenceMimeType,
  type PrivateImagePurpose,
  type StorageUploadInput,
} from '@/modules/storage/storage-interface';

export const maximumEvidenceBytes = 5 * 1024 * 1024;
export const maximumCatalogImageBytes = 2 * 1024 * 1024;

const catalogImageStorageKeyPattern =
  /^catalog-images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const evidenceStorageKeyPattern =
  /^(?:(?:installation|warranty)-evidence|catalog-images)\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const formats: Record<
  EvidenceMimeType,
  {
    extension: '.jpg' | '.png' | '.webp';
    acceptedExtensions: readonly string[];
    signature: Buffer;
  }
> = {
  'image/jpeg': {
    extension: '.jpg',
    acceptedExtensions: ['.jpg', '.jpeg'],
    signature: Buffer.from([0xff, 0xd8, 0xff]),
  },
  'image/png': {
    extension: '.png',
    acceptedExtensions: ['.png'],
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  'image/webp': {
    extension: '.webp',
    acceptedExtensions: ['.webp'],
    signature: Buffer.from('RIFF'),
  },
};

export type ValidatedEvidenceUpload = {
  content: Buffer;
  contentType: EvidenceMimeType;
  extension: '.jpg' | '.png' | '.webp';
  checksumSha256: string;
};

function maximumBytesForPurpose(
  purpose: PrivateImagePurpose | undefined,
): number {
  return purpose === 'catalog'
    ? maximumCatalogImageBytes
    : maximumEvidenceBytes;
}

function isStrictBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    value,
  );
}

export function validateEvidenceUpload(
  input: StorageUploadInput,
): ValidatedEvidenceUpload {
  if (
    input.filename !== path.basename(input.filename) ||
    input.filename.includes('/') ||
    input.filename.includes('\\')
  )
    throw new StorageValidationError('Invalid filename.');

  const format = formats[input.contentType];
  if (!format)
    throw new StorageValidationError('Unsupported evidence MIME type.');
  if (
    !format.acceptedExtensions.includes(
      path.extname(input.filename).toLowerCase(),
    )
  )
    throw new StorageValidationError(
      'File extension does not match MIME type.',
    );
  if (!isStrictBase64(input.contentBase64))
    throw new StorageValidationError('Invalid base64 content.');

  const content = Buffer.from(input.contentBase64, 'base64');
  const validSignature = content
    .subarray(0, format.signature.length)
    .equals(format.signature);
  const validWebp =
    input.contentType !== 'image/webp' ||
    content.subarray(8, 12).equals(Buffer.from('WEBP'));
  if (
    content.length === 0 ||
    content.length > maximumBytesForPurpose(input.purpose) ||
    !validSignature ||
    !validWebp
  )
    throw new StorageValidationError('Invalid image content or size.');

  return {
    content,
    contentType: input.contentType,
    extension: format.extension,
    checksumSha256: createHash('sha256').update(content).digest('hex'),
  };
}

export function createEvidenceStorageKey(
  extension: string,
  purpose: StorageUploadInput['purpose'] = 'installation',
): string {
  if (
    purpose !== 'catalog' &&
    purpose !== 'installation' &&
    purpose !== 'warranty'
  ) {
    throw new StorageValidationError('Invalid private image purpose.');
  }
  const prefix =
    purpose === 'catalog' ? 'catalog-images' : `${purpose}-evidence`;
  return `${prefix}/${randomUUID()}${extension}`;
}

export function assertEvidenceStorageKey(storageKey: string): string {
  if (!evidenceStorageKeyPattern.test(storageKey))
    throw new StorageValidationError('Invalid storage key.');
  return storageKey;
}

export function isCatalogImageStorageKey(storageKey: string): boolean {
  return catalogImageStorageKeyPattern.test(storageKey);
}

export function maximumBytesForStorageKey(storageKey: string): number {
  return isCatalogImageStorageKey(assertEvidenceStorageKey(storageKey))
    ? maximumCatalogImageBytes
    : maximumEvidenceBytes;
}

export const validatePrivateImageUpload = validateEvidenceUpload;
export const createPrivateImageStorageKey = createEvidenceStorageKey;
export const assertPrivateImageStorageKey = assertEvidenceStorageKey;
