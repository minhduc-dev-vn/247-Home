import { Prisma } from '@prisma/client';

import {
  IdentityError,
  registrationSchema,
  registerCustomer,
} from '@/modules/identity';
import { withJsonMutation } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';
import { logApplicationError } from '@/shared/observability/logger';

function safeErrorCode(error: unknown): string {
  if (error instanceof IdentityError) return error.code;
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    return `PRISMA_${error.code}`;
  if (error instanceof Prisma.PrismaClientInitializationError)
    return 'PRISMA_INITIALIZATION_ERROR';
  if (error instanceof Error) return error.name || 'UNEXPECTED_ERROR';
  return 'UNKNOWN_ERROR';
}

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    registrationSchema,
    { rateLimitAction: 'register', rateLimitScope: 'register' },
    async (requestId, input) => {
      try {
        await registerCustomer(input);
        return createSuccessResponse({ created: true }, requestId, {
          status: 201,
        });
      } catch (error: unknown) {
        if (
          error instanceof IdentityError &&
          error.code === 'EMAIL_UNAVAILABLE'
        )
          return createErrorResponse(
            'VALIDATION_ERROR',
            'Khong the tao tai khoan.',
            requestId,
            422,
          );
        logApplicationError({
          requestId,
          route: '/api/v1/auth/register',
          category: 'customer-registration',
          errorCode: safeErrorCode(error),
        });
        return createErrorResponse(
          'INTERNAL_ERROR',
          'Khong the tao tai khoan.',
          requestId,
          500,
        );
      }
    },
  );
}
