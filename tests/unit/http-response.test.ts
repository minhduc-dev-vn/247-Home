import { describe, expect, it } from 'vitest';

import {
  createErrorResponse,
  createSuccessResponse,
  getRequestId,
} from '@/shared/http/response';

describe('HTTP response helpers', () => {
  it('keeps a valid request identifier', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-request-id': 'req_123' },
    });

    expect(getRequestId(request)).toBe('req_123');
  });

  it('replaces an invalid request identifier', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-request-id': 'invalid value' },
    });

    expect(getRequestId(request)).toMatch(/^req_/);
  });

  it('uses the documented error envelope without cacheable error data', async () => {
    const response = createErrorResponse(
      'INTERNAL_ERROR',
      'Dịch vụ chưa sẵn sàng.',
      'req_123',
      503,
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        details: {},
        fieldErrors: {},
        message: 'Dịch vụ chưa sẵn sàng.',
        requestId: 'req_123',
      },
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Request-Id')).toBe('req_123');
  });

  it('uses the documented success envelope', async () => {
    const response = createSuccessResponse({ status: 'ok' }, 'req_123');

    await expect(response.json()).resolves.toEqual({
      data: { status: 'ok' },
      meta: { requestId: 'req_123' },
    });
  });

  it('serializes bigint values as precise decimal strings', async () => {
    const response = createSuccessResponse(
      { amount: 9_007_199_254_740_993n },
      'req_money',
    );

    await expect(response.json()).resolves.toEqual({
      data: { amount: '9007199254740993' },
      meta: { requestId: 'req_money' },
    });
  });
});
