import { afterEach, describe, expect, it, vi } from 'vitest';

import { withApiHandler } from '@/shared/http/api-handler';
import {
  configureStructuredLogger,
  logApplicationError,
  logHttpRequest,
  resetStructuredLoggerForTest,
  type StructuredLogger,
} from '@/shared/observability/logger';

function collectingLogger() {
  const logger = {
    info: vi.fn<StructuredLogger['info']>(),
    warn: vi.fn<StructuredLogger['warn']>(),
    error: vi.fn<StructuredLogger['error']>(),
  };
  configureStructuredLogger(logger);
  return logger;
}

describe('structured HTTP logging', () => {
  afterEach(() => resetStructuredLoggerForTest());

  it('emits only allowlisted request metadata without query or headers', async () => {
    const logger = collectingLogger();
    const response = await withApiHandler(
      new Request('http://localhost/api/test?token=secret', {
        headers: { Authorization: 'Bearer secret', 'x-request-id': 'safe-id' },
      }),
      async () => Response.json({ ok: true }, { status: 201 }),
    );

    expect(response.status).toBe(201);
    expect(logger.info).toHaveBeenCalledWith(
      'http.request.completed',
      expect.objectContaining({
        requestId: expect.stringMatching(/^req_/),
        clientRequestId: 'safe-id',
        method: 'GET',
        route: '/api/test',
        status: 201,
      }),
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('secret');
  });

  it('emits safe application error metadata without request payloads', () => {
    const logger = collectingLogger();

    logApplicationError({
      requestId: 'request-500',
      route: '/api/v1/auth/register',
      category: 'customer-registration',
      errorCode: 'PrismaClientInitializationError',
    });

    expect(logger.error).toHaveBeenCalledWith('application.error', {
      requestId: 'request-500',
      route: '/api/v1/auth/register',
      category: 'customer-registration',
      errorCode: 'PrismaClientInitializationError',
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('password');
  });

  it('routes application errors to the error level, never to info', () => {
    const logger = collectingLogger();

    logApplicationError({
      requestId: 'request-500',
      route: '/api/v1/orders',
      category: 'unhandled-exception',
      errorCode: 'Error',
    });

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps completed requests on the info level', () => {
    const logger = collectingLogger();

    logHttpRequest({
      requestId: 'request-200',
      method: 'GET',
      route: '/api/v1/products',
      status: 200,
      durationMs: 12,
    });

    expect(logger.info).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('stdout log serialization', () => {
  afterEach(() => {
    resetStructuredLoggerForTest();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function captureStdout() {
    // The default logger stays silent under NODE_ENV=test, so the serialized
    // shape shipped to production is only observable with the env stubbed.
    vi.stubEnv('NODE_ENV', 'production');
    resetStructuredLoggerForTest();
    return vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  }

  it('serializes application errors with the error level', () => {
    const write = captureStdout();

    logApplicationError({
      requestId: 'request-500',
      route: '/api/v1/orders',
      category: 'unhandled-exception',
      errorCode: 'Error',
      errorMessage: 'boom',
    });

    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({
      level: 'error',
      event: 'application.error',
      errorCode: 'Error',
      errorMessage: 'boom',
    });
  });

  it('serializes completed requests with the info level', () => {
    const write = captureStdout();

    logHttpRequest({
      requestId: 'request-200',
      method: 'GET',
      route: '/api/v1/products',
      status: 200,
      durationMs: 12,
    });

    expect(JSON.parse(String(write.mock.calls[0][0]))).toMatchObject({
      level: 'info',
      event: 'http.request.completed',
    });
  });
});
