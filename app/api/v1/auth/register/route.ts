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
