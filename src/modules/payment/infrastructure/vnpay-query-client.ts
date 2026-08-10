import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  getVnpayConfig,
  toVnpayDate,
  VnpayConfigurationError,
} from '@/modules/payment/infrastructure/vnpay';

const responseFields = [
  'vnp_ResponseId',
  'vnp_Command',
  'vnp_ResponseCode',
  'vnp_Message',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_Amount',
  'vnp_BankCode',
  'vnp_PayDate',
  'vnp_TransactionNo',
  'vnp_TransactionType',
  'vnp_TransactionStatus',
  'vnp_OrderInfo',
  'vnp_PromotionCode',
  'vnp_PromotionAmount',
] as const;

export type VnpayQueryResponse = Record<string, string> & {
  vnp_Amount: string;
  vnp_ResponseCode: string;
  vnp_SecureHash: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
};

type VnpayQueryInput = {
  createdAt?: Date;
  ipAddress: string;
  orderInfo: string;
  requestId: string;
  transactionDate: Date;
  transactionNo?: string;
  txnRef: string;
};

function hmac(value: string, secret: string): string {
  return createHmac('sha512', secret).update(value, 'utf8').digest('hex');
}

function requestChecksumData(parameters: Record<string, string>): string {
  return [
    'vnp_RequestId',
    'vnp_Version',
    'vnp_Command',
    'vnp_TmnCode',
    'vnp_TxnRef',
    'vnp_TransactionDate',
    'vnp_CreateDate',
    'vnp_IpAddr',
    'vnp_OrderInfo',
  ]
    .map((field) => parameters[field] ?? '')
    .join('|');
}

export function signVnpayQueryRequest(
  parameters: Record<string, string>,
  secret: string,
): string {
  return hmac(requestChecksumData(parameters), secret);
}

export function signVnpayQueryResponse(
  parameters: Record<string, string>,
  secret: string,
): string {
  return hmac(
    responseFields.map((field) => parameters[field] ?? '').join('|'),
    secret,
  );
}

export function verifyVnpayQueryResponse(
  parameters: Record<string, string>,
  secret: string,
): parameters is VnpayQueryResponse {
  const provided = parameters.vnp_SecureHash?.toLowerCase();
  if (!provided || !/^[a-f0-9]{128}$/.test(provided)) return false;
  const expected = signVnpayQueryResponse(parameters, secret);
  return timingSafeEqual(
    Buffer.from(provided, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

function queryUrl(environment: NodeJS.ProcessEnv): string {
  const value =
    environment.VNPAY_QUERY_URL ??
    'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:')
    throw new VnpayConfigurationError('VNPAY_QUERY_URL must use HTTPS.');
  return parsed.toString();
}

export async function queryVnpayTransaction(
  input: VnpayQueryInput,
  options: {
    environment?: NodeJS.ProcessEnv;
    fetch?: typeof fetch;
  } = {},
): Promise<VnpayQueryResponse> {
  const environment = options.environment ?? process.env;
  const config = getVnpayConfig(environment);
  const parameters: Record<string, string> = {
    vnp_RequestId: input.requestId,
    vnp_Version: '2.1.0',
    vnp_Command: 'querydr',
    vnp_TmnCode: config.tmnCode,
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: input.orderInfo.slice(0, 255),
    vnp_TransactionNo: input.transactionNo ?? '',
    vnp_TransactionDate: toVnpayDate(input.transactionDate),
    vnp_CreateDate: toVnpayDate(input.createdAt ?? new Date()),
    vnp_IpAddr: input.ipAddress,
  };
  parameters.vnp_SecureHash = signVnpayQueryRequest(
    parameters,
    config.hashSecret,
  );

  const response = await (options.fetch ?? fetch)(queryUrl(environment), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parameters),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`VNPay QueryDR returned HTTP ${response.status}.`);
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > 64 * 1024)
    throw new Error('VNPay QueryDR response exceeded 64 KiB.');

  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('VNPay QueryDR returned an invalid response.');
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string'))
    throw new Error('VNPay QueryDR returned non-string fields.');
  const result = Object.fromEntries(entries) as Record<string, string>;
  if (!verifyVnpayQueryResponse(result, config.hashSecret))
    throw new Error('VNPay QueryDR response signature is invalid.');
  if (
    result.vnp_TmnCode !== config.tmnCode ||
    result.vnp_TxnRef !== input.txnRef
  )
    throw new Error('VNPay QueryDR response identity does not match.');
  return result;
}
