import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const secureHashFields = new Set(['vnp_SecureHash', 'vnp_SecureHashType']);

export type VnpayParameters = Record<string, string>;

export type VnpayConfig = {
  hashSecret: string;
  paymentUrl: string;
  returnUrl: string;
  tmnCode: string;
};

export class VnpayConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VnpayConfigurationError';
  }
}

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new VnpayConfigurationError(`${name} is required.`);
  return normalized;
}

function validatedUrl(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new VnpayConfigurationError(`${name} must be a valid URL.`);
  }
  const localHttp =
    url.protocol === 'http:' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !localHttp)
    throw new VnpayConfigurationError(`${name} must use HTTPS.`);
  return url.toString();
}

export function getVnpayConfig(
  environment: NodeJS.ProcessEnv = process.env,
): VnpayConfig {
  const tmnCode = required('VNPAY_TMN_CODE', environment.VNPAY_TMN_CODE);
  const hashSecret = required(
    'VNPAY_HASH_SECRET',
    environment.VNPAY_HASH_SECRET,
  );
  if (!/^[A-Za-z0-9_-]{4,32}$/.test(tmnCode))
    throw new VnpayConfigurationError('VNPAY_TMN_CODE has an invalid format.');
  if (hashSecret.length < 16)
    throw new VnpayConfigurationError(
      'VNPAY_HASH_SECRET must contain at least 16 characters.',
    );

  const baseUrl = required(
    'NEXTAUTH_URL or APP_ORIGIN',
    environment.NEXTAUTH_URL ?? environment.APP_ORIGIN,
  );
  return {
    tmnCode,
    hashSecret,
    paymentUrl: validatedUrl(
      'VNPAY_PAYMENT_URL',
      environment.VNPAY_PAYMENT_URL ??
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    ),
    returnUrl: validatedUrl(
      'VNPAY_RETURN_URL',
      environment.VNPAY_RETURN_URL ??
        new URL('/api/v1/payment/return', baseUrl).toString(),
    ),
  };
}

function encode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

export function canonicalizeVnpayParameters(
  parameters: VnpayParameters,
): string {
  return Object.entries(parameters)
    .filter(([key, value]) => !secureHashFields.has(key) && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join('&');
}

export function signVnpayParameters(
  parameters: VnpayParameters,
  hashSecret: string,
): string {
  return createHmac('sha512', hashSecret)
    .update(canonicalizeVnpayParameters(parameters), 'utf8')
    .digest('hex');
}

export function verifyVnpaySignature(
  parameters: VnpayParameters,
  hashSecret: string,
): boolean {
  const provided = parameters.vnp_SecureHash?.toLowerCase();
  if (!provided || !/^[a-f0-9]{128}$/.test(provided)) return false;
  const expected = signVnpayParameters(parameters, hashSecret);
  return timingSafeEqual(
    Buffer.from(provided, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

export function buildVnpayPaymentUrl(
  config: VnpayConfig,
  parameters: VnpayParameters,
): string {
  const signed = {
    ...parameters,
    vnp_SecureHash: signVnpayParameters(parameters, config.hashSecret),
  };
  return `${config.paymentUrl.replace(/\?$/, '')}?${canonicalizeVnpayParameters(signed)}&vnp_SecureHash=${signed.vnp_SecureHash}`;
}

export function toVnpayDate(value: Date): string {
  const vietnamTime = new Date(value.getTime() + 7 * 60 * 60 * 1_000);
  const part = (number: number) => String(number).padStart(2, '0');
  return `${vietnamTime.getUTCFullYear()}${part(vietnamTime.getUTCMonth() + 1)}${part(vietnamTime.getUTCDate())}${part(vietnamTime.getUTCHours())}${part(vietnamTime.getUTCMinutes())}${part(vietnamTime.getUTCSeconds())}`;
}

export function parseVnpayDate(value: string | undefined): Date | null {
  if (!value || !/^\d{14}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  const parsed = new Date(
    Date.UTC(year, month - 1, day, hour - 7, minute, second),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function vnpayEventKey(parameters: VnpayParameters): string {
  return createHash('sha256')
    .update(canonicalizeVnpayParameters(parameters), 'utf8')
    .digest('hex');
}
