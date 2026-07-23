import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { CatalogError } from '@/modules/catalog';
import { LocalImageStorageError } from '@/modules/catalog/infrastructure/local-image-storage';
import { OperationsPolicyError } from '@/modules/operations/domain/installation-transition';
import {
  StorageConfigurationError,
  StorageProviderError,
  StorageValidationError,
} from '@/modules/storage';
import {
  consumeRateLimit,
  type RateLimitAction,
} from '@/modules/identity/infrastructure/rate-limiter';
import { trustedClientAddress } from '@/shared/http/client-address';
import { createErrorResponse, getRequestId } from '@/shared/http/response';
import { logHttpRequest } from '@/shared/observability/logger';

class RequestValidationError extends Error {
  constructor() {
    super('Dữ liệu gửi lên không hợp lệ.');
    this.name = 'RequestValidationError';
  }
}

class RequestSecurityError extends Error {
  constructor(
    readonly code:
      | 'FORBIDDEN'
      | 'PAYLOAD_TOO_LARGE'
      | 'RATE_LIMITED'
      | 'UNSUPPORTED_MEDIA_TYPE',
    readonly status: 403 | 413 | 415 | 429,
    message: string,
    readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

type JsonBodyOptions = { maxBytes?: number };
type MutationOptions = {
  maxBodyBytes?: number;
  rateLimitScope: string;
  rateLimitAction?: RateLimitAction;
};

const defaultJsonBodyBytes = 8 * 1024 * 1024;
const defaultMutationJsonBodyBytes = 64 * 1024;

function parseConfiguredOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedMutationOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const value of [process.env.NEXTAUTH_URL, process.env.APP_ORIGIN]) {
    const origin = parseConfiguredOrigin(value);
    if (origin) origins.add(origin);
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return origins;
}

function mutationClientKey(request: Request): string {
  return trustedClientAddress(request);
}

function requireMutationRequest(
  request: Request,
  options: MutationOptions,
  expectsJson: boolean,
) {
  const origin = request.headers.get('origin');
  if (!origin || !allowedMutationOrigins().has(origin))
    throw new RequestSecurityError('FORBIDDEN', 403, 'Origin khong duoc phep.');
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (expectsJson && !/^application\/json(?:\s*;|$)/.test(contentType))
    throw new RequestSecurityError(
      'UNSUPPORTED_MEDIA_TYPE',
      415,
      'Content-Type phai la application/json.',
    );
  const rateLimit = consumeRateLimit(
    options.rateLimitAction ?? 'sensitive-mutation',
    `${options.rateLimitScope}:${mutationClientKey(request)}`,
  );
  if (!rateLimit.allowed)
    throw new RequestSecurityError(
      'RATE_LIMITED',
      429,
      'Qua nhieu yeu cau. Vui long thu lai sau.',
      { 'Retry-After': String(rateLimit.retryAfterSeconds) },
    );
}

export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
  options: JsonBodyOptions = {},
): Promise<z.output<T>> {
  const maxBytes = options.maxBytes ?? defaultJsonBodyBytes;
  const raw = await readBoundedBody(request, maxBytes);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new RequestValidationError();
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new RequestValidationError();
  return parsed.data;
}

async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes)
    throw new RequestSecurityError(
      'PAYLOAD_TOO_LARGE',
      413,
      'Noi dung yeu cau qua lon.',
    );
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    throw new RequestValidationError();
  }
  if (new TextEncoder().encode(raw).byteLength > maxBytes)
    throw new RequestSecurityError(
      'PAYLOAD_TOO_LARGE',
      413,
      'Noi dung yeu cau qua lon.',
    );
  return raw;
}

export async function withOperationsJsonMutation<T extends z.ZodType>(
  request: Request,
  schema: T,
  options: MutationOptions,
  action: (requestId: string, input: z.output<T>) => Promise<Response>,
): Promise<Response> {
  return withJsonMutation(request, schema, options, action);
}

export async function withJsonMutation<T extends z.ZodType>(
  request: Request,
  schema: T,
  options: MutationOptions,
  action: (requestId: string, input: z.output<T>) => Promise<Response>,
): Promise<Response> {
  return withApiHandler(request, async (requestId) => {
    requireMutationRequest(request, options, true);
    const input = await parseJson(request, schema, {
      maxBytes: options.maxBodyBytes ?? defaultMutationJsonBodyBytes,
    });
    const response = await action(requestId, input);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  });
}

export async function withMutation(
  request: Request,
  options: MutationOptions,
  action: (requestId: string) => Promise<Response>,
): Promise<Response> {
  return withApiHandler(request, async (requestId) => {
    requireMutationRequest(request, options, false);
    await readBoundedBody(request, options.maxBodyBytes ?? 0);
    const response = await action(requestId);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  });
}

export function parseSearchParams<T extends z.ZodType>(
  request: Request,
  schema: T,
): z.output<T> {
  const params = Object.fromEntries(
    new URL(request.url).searchParams.entries(),
  );
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new RequestValidationError();
  return parsed.data;
}

export function parseCuid(value: string): string {
  if (!z.string().cuid().safeParse(value).success) {
    throw new RequestValidationError();
  }
  return value;
}

export async function withApiHandler(
  request: Request,
  action: (requestId: string) => Promise<Response>,
): Promise<Response> {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  const complete = (response: Response) => {
    logHttpRequest({
      requestId,
      method: request.method,
      route: new URL(request.url).pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  };
  try {
    return complete(await action(requestId));
  } catch (error: unknown) {
    if (error instanceof RequestValidationError) {
      return complete(
        createErrorResponse('VALIDATION_ERROR', error.message, requestId, 400),
      );
    }
    if (error instanceof RequestSecurityError) {
      return complete(
        createErrorResponse(
          error.code,
          error.message,
          requestId,
          error.status,
          { headers: error.headers },
        ),
      );
    }
    if (
      error instanceof LocalImageStorageError ||
      error instanceof StorageValidationError
    ) {
      return complete(
        createErrorResponse(
          'VALIDATION_ERROR',
          'Tệp ảnh không hợp lệ.',
          requestId,
          400,
        ),
      );
    }
    if (
      error instanceof StorageConfigurationError ||
      error instanceof StorageProviderError
    ) {
      return complete(
        createErrorResponse(
          'STORAGE_UNAVAILABLE',
          'KhÃ´ng thá»ƒ xá»­ lÃ½ tá»‡p lÃºc nÃ y.',
          requestId,
          503,
        ),
      );
    }
    if (error instanceof CatalogError) {
      const status =
        error.code === 'UNAUTHENTICATED'
          ? 401
          : error.code === 'FORBIDDEN'
            ? 403
            : error.code === 'NOT_FOUND'
              ? 404
              : 409;
      return complete(
        createErrorResponse(error.code, error.message, requestId, status),
      );
    }
    if (error instanceof OperationsPolicyError) {
      const status =
        error.code === 'UNAUTHENTICATED'
          ? 401
          : error.code === 'FORBIDDEN'
            ? 403
            : 409;
      return complete(
        createErrorResponse(error.code, error.message, requestId, status),
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return complete(
        createErrorResponse(
          'CONFLICT',
          'Dữ liệu đã tồn tại hoặc xung đột.',
          requestId,
          409,
        ),
      );
    }
    return complete(
      createErrorResponse(
        'INTERNAL_ERROR',
        'Không thể xử lý yêu cầu lúc này.',
        requestId,
        500,
      ),
    );
  }
}
