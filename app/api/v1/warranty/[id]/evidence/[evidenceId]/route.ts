import { getWarrantyEvidencePreview } from '@/modules/warranty';
import { getCurrentActor } from '@/shared/auth/server';
import { parseCuid, withApiHandler } from '@/shared/http/api-handler';

const extensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; evidenceId: string }> },
) {
  return withApiHandler(request, async (requestId) => {
    const params = await context.params;
    const evidence = await getWarrantyEvidencePreview(
      await getCurrentActor(),
      parseCuid(params.id),
      parseCuid(params.evidenceId),
    );
    const mimeType = evidence.mimeType as keyof typeof extensions;
    const extension = extensions[mimeType];
    if (!extension) throw new Error('Unsupported stored evidence MIME type.');
    return new Response(new Uint8Array(evidence.content), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="warranty-evidence.${extension}"`,
        'Content-Type': mimeType,
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    });
  });
}
