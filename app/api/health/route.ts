import { createSuccessResponse, getRequestId } from '@/shared/http/response';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return createSuccessResponse({ status: 'ok' }, getRequestId(request), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
