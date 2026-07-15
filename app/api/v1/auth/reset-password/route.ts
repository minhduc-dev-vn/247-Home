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
