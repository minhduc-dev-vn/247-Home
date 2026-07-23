import { describe, expect, it, vi } from 'vitest';

import {
  queryVnpayTransaction,
  signVnpayQueryRequest,
  signVnpayQueryResponse,
  verifyVnpayQueryResponse,
} from '@/modules/payment';

const secret = 'query-test-secret-at-least-16-chars';
const environment = {
  NODE_ENV: 'test',
  NEXTAUTH_URL: 'https://merchant.example.test',
  VNPAY_TMN_CODE: 'TESTCODE',
  VNPAY_HASH_SECRET: secret,
  VNPAY_PAYMENT_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  VNPAY_QUERY_URL:
    'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
};

describe('VNPay QueryDR client', () => {
  it('signs requests using the provider field order', () => {
    expect(
      signVnpayQueryRequest(
        {
          vnp_RequestId: 'request01',
          vnp_Version: '2.1.0',
          vnp_Command: 'querydr',
          vnp_TmnCode: 'TESTCODE',
          vnp_TxnRef: '247ORDER',
          vnp_TransactionDate: '20260722100405',
          vnp_CreateDate: '20260722100505',
          vnp_IpAddr: '127.0.0.1',
          vnp_OrderInfo: 'Reconcile order',
        },
        secret,
      ),
    ).toMatch(/^[a-f0-9]{128}$/);
  });

  it('verifies the signed response and rejects tampering', () => {
    const response = {
      vnp_ResponseId: 'response01',
      vnp_Command: 'querydr',
      vnp_ResponseCode: '00',
      vnp_Message: 'Success',
      vnp_TmnCode: 'TESTCODE',
      vnp_TxnRef: '247ORDER',
      vnp_Amount: '10000000',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20260722100405',
      vnp_TransactionNo: '123456',
      vnp_TransactionType: '01',
      vnp_TransactionStatus: '00',
      vnp_OrderInfo: 'Reconcile order',
      vnp_PromotionCode: '',
      vnp_PromotionAmount: '',
    };
    const signed = {
      ...response,
      vnp_SecureHash: signVnpayQueryResponse(response, secret),
    };
    expect(verifyVnpayQueryResponse(signed, secret)).toBe(true);
    expect(
      verifyVnpayQueryResponse({ ...signed, vnp_Amount: '10000001' }, secret),
    ).toBe(false);
  });

  it('validates a real-shaped QueryDR response before returning it', async () => {
    const response = {
      vnp_ResponseId: 'response02',
      vnp_Command: 'querydr',
      vnp_ResponseCode: '00',
      vnp_Message: 'Success',
      vnp_TmnCode: 'TESTCODE',
      vnp_TxnRef: '247ORDER',
      vnp_Amount: '10000000',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20260722100405',
      vnp_TransactionNo: '123456',
      vnp_TransactionType: '01',
      vnp_TransactionStatus: '00',
      vnp_OrderInfo: 'Reconcile order',
      vnp_PromotionCode: '',
      vnp_PromotionAmount: '',
    };
    const signed = {
      ...response,
      vnp_SecureHash: signVnpayQueryResponse(response, secret),
    };
    const fetchMock = vi.fn(
      async (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) => Response.json(signed, { status: 200 }),
    );

    await expect(
      queryVnpayTransaction(
        {
          requestId: 'request02',
          txnRef: '247ORDER',
          transactionDate: new Date('2026-07-22T03:04:05.000Z'),
          createdAt: new Date('2026-07-22T03:05:05.000Z'),
          ipAddress: '127.0.0.1',
          orderInfo: 'Reconcile order',
        },
        {
          environment: environment as NodeJS.ProcessEnv,
          fetch: fetchMock as unknown as typeof fetch,
        },
      ),
    ).resolves.toMatchObject({
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as Record<string, string>;
    expect(body.vnp_SecureHash).toBe(
      signVnpayQueryRequest(body, environment.VNPAY_HASH_SECRET),
    );
  });
});
