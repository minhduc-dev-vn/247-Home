import { getPublicImage } from '@/modules/catalog';
import { getProductImageStorage } from '@/modules/catalog/infrastructure/product-image-storage';
import { withApiHandler } from '@/shared/http/api-handler';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApiHandler(request, async () => {
    const { id } = await context.params;
    const image = await getPublicImage(id);
    if (!image) return new Response(null, { status: 404 });
    const content = await getProductImageStorage().download(image.storageKey);
    return content
      ? new Response(new Uint8Array(content), {
          headers: {
            'Content-Type': image.mimeType,
            'Content-Length': String(content.byteLength),
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      : new Response(null, { status: 404 });
  });
}
