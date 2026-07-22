import { describe, expect, it } from 'vitest';

import {
  canonicalizeVnpayParameters,
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
});
