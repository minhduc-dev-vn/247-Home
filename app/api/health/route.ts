import { createSuccessResponse, getRequestId } from '@/shared/http/response';

export const dynamic = 'force-dynamic';

function deploymentRevision(): string {
  const revision = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_SHA;
  return revision && /^[a-f0-9]{7,64}$/i.test(revision)
    ? revision.slice(0, 12)
    : 'unknown';
}

export function GET(request: Request) {
  return createSuccessResponse(
    { status: 'ok', revision: deploymentRevision() },
    getRequestId(request),
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
