async function main() {
  const baseUrl = process.env.STAGING_BASE_URL;
  const originUrl = process.env.STAGING_ORIGIN_URL;
  const requestCount = Number(process.env.RATE_LIMIT_PROBE_REQUESTS ?? '110');

  if (!baseUrl || new URL(baseUrl).protocol !== 'https:')
    throw new Error('STAGING_BASE_URL must be an HTTPS URL.');
  if (!Number.isInteger(requestCount) || requestCount < 2 || requestCount > 500)
    throw new Error('RATE_LIMIT_PROBE_REQUESTS must be between 2 and 500.');

  const endpoint = new URL('/api/v1/auth/forgot-password', baseUrl);
  let limitedResponse: Response | undefined;
  for (let attempt = 0; attempt < requestCount; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: new URL(baseUrl).origin,
        'X-Forwarded-For': `203.0.113.${(attempt % 200) + 1}`,
      },
      body: JSON.stringify({
        email: `p0-rate-limit-probe-${Date.now()}@example.invalid`,
      }),
      redirect: 'manual',
    });
    if (response.status === 429) {
      limitedResponse = response;
      break;
    }
    if (response.status >= 500)
      throw new Error(`Rate-limit probe received HTTP ${response.status}.`);
  }

  if (!limitedResponse)
    throw new Error(
      `No shared edge 429 response after ${requestCount} requests.`,
    );
  if (!limitedResponse.headers.get('retry-after'))
    throw new Error('The edge 429 response is missing Retry-After.');

  if (originUrl) {
    const direct = await fetch(new URL('/api/health', originUrl), {
      redirect: 'manual',
    });
    if (direct.status !== 403)
      throw new Error(`Direct origin returned ${direct.status}; expected 403.`);
  }

  console.log(
    JSON.stringify({
      check: 'staging-shared-rate-limit',
      directOriginChecked: Boolean(originUrl),
      status: 'PASS',
    }),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Rate probe failed');
  process.exitCode = 1;
});
