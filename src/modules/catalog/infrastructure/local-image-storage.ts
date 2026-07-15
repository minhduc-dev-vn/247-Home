import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const imageDirectory = path.join(
  process.cwd(),
  '.local-uploads',
  'product-images',
);
const maxImageBytes = 2 * 1024 * 1024;

const allowedImages = {
  'image/jpeg': {
    extension: '.jpg',
    signature: Buffer.from([0xff, 0xd8, 0xff]),
  },
  'image/png': {
    extension: '.png',
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  'image/webp': {
    extension: '.webp',
    signature: Buffer.from([0x52, 0x49, 0x46, 0x46]),
  },
} as const;

type ImageMimeType = keyof typeof allowedImages;

function hasSignature(content: Buffer, contentType: ImageMimeType): boolean {
  const expected = allowedImages[contentType].signature;
  if (!content.subarray(0, expected.length).equals(expected)) return false;
  return (
    contentType !== 'image/webp' ||
    content.subarray(8, 12).equals(Buffer.from('WEBP'))
  );
}

function extensionMatches(
  filename: string,
  contentType: ImageMimeType,
): boolean {
  const extension = path.extname(filename).toLowerCase();
  if (contentType === 'image/jpeg')
    return extension === '.jpg' || extension === '.jpeg';
  return extension === allowedImages[contentType].extension;
}

export class LocalImageStorageError extends Error {}

export async function saveLocalProductImage(input: {
  filename: string;
  contentType: ImageMimeType;
  contentBase64: string;
}) {
  if (process.env.NODE_ENV === 'production') {
    throw new LocalImageStorageError(
      'Local image storage is disabled in production.',
    );
  }
  if (
    input.filename !== path.basename(input.filename) ||
    input.filename.includes('/') ||
    input.filename.includes('\\')
  ) {
    throw new LocalImageStorageError('Invalid filename.');
  }
  if (!extensionMatches(input.filename, input.contentType)) {
    throw new LocalImageStorageError('Loại tệp và MIME type không khớp.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64)) {
    throw new LocalImageStorageError('Nội dung tệp không hợp lệ.');
  }
  const content = Buffer.from(input.contentBase64, 'base64');
  if (
    !content.length ||
    content.length > maxImageBytes ||
    !hasSignature(content, input.contentType)
  ) {
    throw new LocalImageStorageError(
      'Tệp ảnh không hợp lệ hoặc vượt quá 2 MB.',
    );
  }
  const storageKey = `${randomUUID()}${allowedImages[input.contentType].extension}`;
  await mkdir(imageDirectory, { recursive: true });
  await writeFile(path.join(imageDirectory, storageKey), content, {
    flag: 'wx',
  });
  return { storageKey, byteSize: content.length };
}

export async function readLocalProductImage(
  storageKey: string,
): Promise<Buffer | null> {
  if (process.env.NODE_ENV === 'production') return null;
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storageKey)) return null;
  try {
    return await readFile(path.join(imageDirectory, storageKey));
  } catch {
    return null;
  }
}

export async function removeLocalProductImage(
  storageKey: string,
): Promise<void> {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(storageKey)) return;
  try {
    await unlink(path.join(imageDirectory, storageKey));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
