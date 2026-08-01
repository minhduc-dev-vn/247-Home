export {};

type VerificationOptions = {
  assetPath: string;
  expectedRevision?: string;
  origin: URL;
  productImageId?: string;
};

function requireValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseOptions(argumentsList: string[]): VerificationOptions {
  let assetPath = '/assets/images/products/khoa-cua-l2.png';
  let expectedRevision: string | undefined;
  let originValue = process.env.CATALOG_MEDIA_VERIFY_ORIGIN;
  let productImageId: string | undefined;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];
    if (argument === '--origin') {
      originValue = value;
      index += 1;
      continue;
    }
    if (argument === '--asset-path') {
      assetPath = requireValue(value, '--asset-path');
      index += 1;
      continue;
    }
    if (argument === '--expected-revision') {
      expectedRevision = requireValue(value, '--expected-revision');
      index += 1;
      continue;
    }
    if (argument === '--product-image-id') {
      productImageId = requireValue(value, '--product-image-id');
      index += 1;
      continue;
    }
    throw new Error(`Unsupported argument: ${argument}`);
  }

  const origin = new URL(
    requireValue(originValue, 'CATALOG_MEDIA_VERIFY_ORIGIN'),
  );
  const localhost =
    origin.hostname === '127.0.0.1' || origin.hostname === 'localhost';
  if (origin.protocol !== 'https:' && !localhost)
    throw new Error('A non-local deployment origin must use HTTPS.');
  if (!assetPath.startsWith('/') || assetPath.includes('..'))
    throw new Error('asset path must be an absolute safe path.');
  if (productImageId && !/^c[a-z0-9]{24,}$/i.test(productImageId))
    throw new Error('product image id is invalid.');

  return { assetPath, expectedRevision, origin, productImageId };
}

async function fetchRequired(url: URL): Promise<Response> {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Unexpected HTTP status for ${url.pathname}.`);
  return response;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const healthResponse = await fetchRequired(
    new URL('/api/health', options.origin),
  );
  const health = (await healthResponse.json()) as {
    data?: { revision?: unknown; status?: unknown };
  };
  if (health.data?.status !== 'ok' || typeof health.data.revision !== 'string')
    throw new Error(
      'Health response does not contain deployment revision metadata.',
    );
  if (
    options.expectedRevision &&
    health.data.revision !== options.expectedRevision.slice(0, 12)
  )
    throw new Error(
      'Deployed revision does not match the expected release revision.',
    );

  const staticAsset = await fetchRequired(
    new URL(options.assetPath, options.origin),
  );
  const contentType = staticAsset.headers.get('content-type') ?? '';
  const cacheControl = staticAsset.headers.get('cache-control') ?? '';
  if (!contentType.startsWith('image/') || !cacheControl)
    throw new Error('Static asset lacks image Content-Type or Cache-Control.');

  let persistedImage: { cacheControl: string; contentType: string } | null =
    null;
  if (options.productImageId) {
    const response = await fetchRequired(
      new URL(
        `/api/v1/product-images/${options.productImageId}`,
        options.origin,
      ),
    );
    const persistedContentType = response.headers.get('content-type') ?? '';
    const persistedCacheControl = response.headers.get('cache-control') ?? '';
    if (!persistedContentType.startsWith('image/') || !persistedCacheControl)
      throw new Error(
        'Persisted image route lacks image Content-Type or Cache-Control.',
      );
    persistedImage = {
      cacheControl: persistedCacheControl,
      contentType: persistedContentType,
    };
  }

  process.stdout.write(
    `${JSON.stringify({
      event: 'catalog.media.deployment.verified',
      persistedImage,
      revision: health.data.revision,
      staticAsset: { cacheControl, contentType, path: options.assetPath },
    })}\n`,
  );
}

void main().catch(() => {
  process.stderr.write(
    `${JSON.stringify({ event: 'catalog.media.deployment.verification_failed' })}\n`,
  );
  process.exitCode = 1;
});
