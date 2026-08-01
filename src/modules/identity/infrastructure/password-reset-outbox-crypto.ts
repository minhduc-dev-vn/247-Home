import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { getServerEnvironment } from '@/shared/validation/env';

const algorithm = 'aes-256-gcm';
const formatVersion = 'v1';
const initializationVectorBytes = 12;
const authenticationTagBytes = 16;

export class PasswordResetOutboxCryptoError extends Error {
  constructor() {
    super('PASSWORD_RESET_OUTBOX_CRYPTO_ERROR');
    this.name = 'PasswordResetOutboxCryptoError';
  }
}

function outboxEncryptionKey(): Buffer {
  return createHash('sha256')
    .update('247-home:password-reset-outbox:v1\0')
    .update(getServerEnvironment().NEXTAUTH_SECRET)
    .digest();
}

function isBase64Url(value: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
  // Node's decoder accepts non-canonical trailing padding bits. Re-encoding
  // rejects alternate spellings that would otherwise authenticate as the same
  // bytes and makes serialized ciphertext validation unambiguous.
  return Buffer.from(value, 'base64url').toString('base64url') === value;
}

export function encryptPasswordResetToken(token: string): string {
  const initializationVector = randomBytes(initializationVectorBytes);
  const cipher = createCipheriv(
    algorithm,
    outboxEncryptionKey(),
    initializationVector,
  );
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    formatVersion,
    initializationVector.toString('base64url'),
    ciphertext.toString('base64url'),
    authenticationTag.toString('base64url'),
  ].join('.');
}

export function decryptPasswordResetToken(encryptedToken: string): string {
  try {
    const [
      version,
      initializationVector,
      ciphertext,
      authenticationTag,
      extra,
    ] = encryptedToken.split('.');
    if (
      version !== formatVersion ||
      extra !== undefined ||
      !initializationVector ||
      !ciphertext ||
      !authenticationTag ||
      !isBase64Url(initializationVector) ||
      !isBase64Url(ciphertext) ||
      !isBase64Url(authenticationTag)
    )
      throw new PasswordResetOutboxCryptoError();

    const iv = Buffer.from(initializationVector, 'base64url');
    const tag = Buffer.from(authenticationTag, 'base64url');
    if (
      iv.byteLength !== initializationVectorBytes ||
      tag.byteLength !== authenticationTagBytes
    )
      throw new PasswordResetOutboxCryptoError();

    const decipher = createDecipheriv(algorithm, outboxEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new PasswordResetOutboxCryptoError();
  }
}
