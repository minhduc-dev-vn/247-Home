import { forgotPasswordSchema, requestPasswordReset } from '@/modules/identity';
import { withJsonMutation } from '@/shared/http/api-handler';
import { createSuccessResponse } from '@/shared/http/response';
import { logApplicationError } from '@/shared/observability/logger';

function safeErrorCode(error: unknown): string {
  if (error instanceof Error) return error.name || 'UNEXPECTED_ERROR';
  return 'UNKNOWN_ERROR';
}

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    forgotPasswordSchema,
    { rateLimitAction: 'forgot-password', rateLimitScope: 'forgot-password' },
    async (requestId, input) => {
      try {
        await requestPasswordReset(input.email);
      } catch (error: unknown) {
        logApplicationError({
          requestId,
          route: '/api/v1/auth/forgot-password',
          category: 'password-reset-request',
          errorCode: safeErrorCode(error),
        });
      }
      return createSuccessResponse({ accepted: true }, requestId, {
        status: 202,
      });
    },
  );
}
