import { forgotPasswordSchema, requestPasswordReset } from '@/modules/identity';
import { withJsonMutation } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';
import {
  describeError,
  logApplicationError,
} from '@/shared/observability/logger';

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
          ...describeError(error),
        });
        return createErrorResponse(
          'INTERNAL_ERROR',
          'Khong the xu ly yeu cau.',
          requestId,
          500,
        );
      }
      return createSuccessResponse({ accepted: true }, requestId);
    },
  );
}
