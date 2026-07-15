import { getPublicImage } from '@/modules/catalog';
import { readLocalProductImage } from '@/modules/catalog/infrastructure/local-image-storage';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const image = await getPublicImage(id);
  if (!image) return new Response(null, { status: 404 });
  const content = await readLocalProductImage(image.storageKey);
  return content
    ? new Response(new Uint8Array(content), {
        headers: {
          'Content-Type': image.mimeType,
          'Cache-Control': 'public, max-age=300, s-maxage=300',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    : new Response(null, { status: 404 });
}
