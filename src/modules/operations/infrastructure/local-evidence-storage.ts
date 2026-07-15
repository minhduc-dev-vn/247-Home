import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.join(
  process.cwd(),
  '.local-uploads',
  'installation-evidence',
);
const temporaryRoot = path.join(root, '.tmp');
const maxBytes = 5 * 1024 * 1024;

const formats = {
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
} as const;

export type EvidenceMimeType = keyof typeof formats;
export type EvidenceInput = {
  filename: string;
  contentType: EvidenceMimeType;
  contentBase64: string;
};
export type StagedEvidence = {
  storageKey: string;
  byteSize: number;
  contentType: EvidenceMimeType;
  temporaryKey: string;
};

export class LocalEvidenceStorageError extends Error {}

function safePath(base: string, key: string): string {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|tmp)$/.test(key))
    throw new LocalEvidenceStorageError('Invalid storage key.');
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(base, key);
  if (!resolved.startsWith(`${resolvedBase}${path.sep}`))
    throw new LocalEvidenceStorageError('Invalid storage path.');
  return resolved;
}

function decodeAndValidate(input: EvidenceInput): Buffer {
  if (process.env.NODE_ENV === 'production')
    throw new LocalEvidenceStorageError(
      'Local evidence storage is disabled in production.',
    );
  if (
    input.filename !== path.basename(input.filename) ||
    input.filename.includes('/') ||
    input.filename.includes('\\')
  )
    throw new LocalEvidenceStorageError('Invalid filename.');
  const format = formats[input.contentType];
  const acceptedExtensions: readonly string[] = format.acceptedExtensions;
  if (!acceptedExtensions.includes(path.extname(input.filename).toLowerCase()))
    throw new LocalEvidenceStorageError(
      'File extension does not match MIME type.',
    );
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      input.contentBase64,
    )
  )
    throw new LocalEvidenceStorageError('Invalid base64 content.');
  const content = Buffer.from(input.contentBase64, 'base64');
  const validSignature = content
    .subarray(0, format.signature.length)
    .equals(format.signature);
  const validWebp =
    input.contentType !== 'image/webp' ||
    content.subarray(8, 12).equals(Buffer.from('WEBP'));
  if (
    !content.length ||
    content.length > maxBytes ||
    !validSignature ||
    !validWebp
  )
    throw new LocalEvidenceStorageError('Invalid image content or size.');
  return content;
}

export async function stageLocalEvidence(
  input: EvidenceInput,
): Promise<StagedEvidence> {
  const content = decodeAndValidate(input);
  const storageKey = `${randomUUID()}${formats[input.contentType].extension}`;
  const temporaryKey = `${randomUUID()}.tmp`;
  await mkdir(temporaryRoot, { recursive: true });
  await writeFile(safePath(temporaryRoot, temporaryKey), content, {
    flag: 'wx',
  });
  return {
    storageKey,
    temporaryKey,
    byteSize: content.length,
    contentType: input.contentType,
  };
}

export async function finalizeLocalEvidence(
  staged: StagedEvidence,
): Promise<void> {
  await mkdir(root, { recursive: true });
  await rename(
    safePath(temporaryRoot, staged.temporaryKey),
    safePath(root, staged.storageKey),
  );
}

export async function discardLocalEvidence(
  staged: StagedEvidence,
): Promise<void> {
  await Promise.all([
    rm(safePath(temporaryRoot, staged.temporaryKey), { force: true }),
    rm(safePath(root, staged.storageKey), { force: true }),
  ]);
}

export async function readLocalEvidence(
  storageKey: string,
): Promise<Buffer | null> {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    return await readFile(safePath(root, storageKey));
  } catch {
    return null;
  }
}

export async function removeLocalEvidence(storageKey: string): Promise<void> {
  await rm(safePath(root, storageKey), { force: true });
}

export async function storeLocalEvidence<T>(
  input: EvidenceInput,
  persist: (staged: StagedEvidence) => Promise<T>,
  compensate: (persisted: T) => Promise<void>,
): Promise<T> {
  const staged = await stageLocalEvidence(input);
  try {
    const persisted = await persist(staged);
    try {
      await finalizeLocalEvidence(staged);
      return persisted;
    } catch (error: unknown) {
      await compensate(persisted);
      throw new LocalEvidenceStorageError(
        error instanceof Error
          ? error.message
          : 'Evidence finalization failed.',
      );
    }
  } catch (error: unknown) {
    await discardLocalEvidence(staged);
    throw error;
  }
}
