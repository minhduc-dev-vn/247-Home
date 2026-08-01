import { describe, expect, it } from 'vitest';

import {
  canonicalizeVnpayParameters,
  isVnpayPubliclyEnabled,
  parseVnpayDate,
  signVnpayParameters,
  toVnpayDate,
  verifyVnpaySignature,
  webhookPaymentOutcome,
} from '@/modules/payment';

const secret = 'unit-test-vnpay-secret-247-home';

describe('VNPay protocol adapter', () => {
  it('sorts and form-encodes fields before signing', () => {
    const parameters = {
      vnp_TxnRef: 'ORDER 247',
      vnp_Amount: '10000000',
      vnp_OrderInfo: 'Thanh toan / 247',
    };
    expect(canonicalizeVnpayParameters(parameters)).toBe(
      'vnp_Amount=10000000&vnp_OrderInfo=Thanh+toan+%2F+247&vnp_TxnRef=ORDER+247',
    );
    const signed = {
      ...parameters,
      vnp_SecureHash: signVnpayParameters(parameters, secret),
    };
    expect(verifyVnpaySignature(signed, secret)).toBe(true);
    expect(
      verifyVnpaySignature({ ...signed, vnp_Amount: '10000001' }, secret),
    ).toBe(false);
  });

  it('uses Vietnam time for protocol timestamps', () => {
    const date = new Date('2026-07-22T03:04:05.000Z');
    expect(toVnpayDate(date)).toBe('20260722100405');
    expect(parseVnpayDate('20260722100405')).toEqual(date);
  });

  it('requires both VNPay success codes', () => {
    expect(
      webhookPaymentOutcome({ responseCode: '00', transactionStatus: '00' }),
    ).toBe('PAID');
    expect(
      webhookPaymentOutcome({ responseCode: '00', transactionStatus: '01' }),
    ).toBe('FAILED');
  });

  it('requires an explicit public-payment gate and a complete configuration', () => {
    const environment: NodeJS.ProcessEnv = {
      APP_ORIGIN: 'https://merchant.example.test',
      NODE_ENV: 'test',
      VNPAY_HASH_SECRET: secret,
      VNPAY_PUBLIC_ENABLED: 'true',
      VNPAY_RETURN_URL: 'https://merchant.example.test/api/v1/payment/return',
      VNPAY_TMN_CODE: 'TEST247',
    };
    expect(isVnpayPubliclyEnabled(environment)).toBe(true);
    expect(
      isVnpayPubliclyEnabled({
        ...environment,
        VNPAY_PUBLIC_ENABLED: 'false',
      }),
    ).toBe(false);
    expect(
      isVnpayPubliclyEnabled({ ...environment, VNPAY_HASH_SECRET: '' }),
    ).toBe(false);
  });
});
