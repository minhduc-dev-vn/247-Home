import { z } from 'zod';

import { getOwnProfile } from '@/modules/identity';
import { getCurrentActor } from '@/shared/auth/server';
import {
  createErrorResponse,
  createSuccessResponse,
  getRequestId,
} from '@/shared/http/response';

const pathSchema = z.object({ id: z.string().cuid() }).strict();

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request);
  const actor = await getCurrentActor();

  if (!actor) {
    return createErrorResponse(
      'UNAUTHENTICATED',
      'Cần đăng nhập.',
      requestId,
      401,
    );
  }

  const parsed = pathSchema.safeParse(await context.params);
  if (!parsed.success) {
    return createErrorResponse(
      'NOT_FOUND',
      'Không tìm thấy tài nguyên.',
      requestId,
      404,
    );
  }

  const profile = await getOwnProfile(actor, parsed.data.id);
  if (!profile) {
    return createErrorResponse(
      'NOT_FOUND',
      'Không tìm thấy tài nguyên.',
      requestId,
      404,
    );
  }

  return createSuccessResponse(profile, requestId, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
