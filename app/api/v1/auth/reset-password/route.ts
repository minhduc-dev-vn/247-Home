import {
  IdentityError,
  resetPassword,
  resetPasswordSchema,
} from '@/modules/identity';
import { withJsonMutation } from '@/shared/http/api-handler';
import {
  createErrorResponse,
  createSuccessResponse,
} from '@/shared/http/response';
import { logApplicationError } from '@/shared/observability/logger';

function safeErrorCode(error: unknown): string {
  if (error instanceof Error) return error.name || 'UNEXPECTED_ERROR';
  return 'UNKNOWN_ERROR';
}

export async function POST(request: Request) {
  return withJsonMutation(
    request,
    resetPasswordSchema,
    { rateLimitAction: 'password-reset', rateLimitScope: 'password-reset' },
    async (requestId, input) => {
      try {
        await resetPassword(input);
        return createSuccessResponse({ updated: true }, requestId);
      } catch (error: unknown) {
        if (
          error instanceof IdentityError &&
          error.code === 'INVALID_RESET_TOKEN'
        )
          return createErrorResponse(
            'VALIDATION_ERROR',
            'Lien ket dat lai khong hop le hoac da het han.',
            requestId,
            422,
          );
        logApplicationError({
          requestId,
          route: '/api/v1/auth/reset-password',
          category: 'password-reset-completion',
          errorCode: safeErrorCode(error),
        });
        return createErrorResponse(
          'INTERNAL_ERROR',
          'Khong the dat lai mat khau.',
          requestId,
          500,
        );
      }
    },
  );
}
