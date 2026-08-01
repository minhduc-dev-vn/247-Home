import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../../app/api/health/route';

describe('health route deployment metadata', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns the Render revision without exposing the full runtime environment', async () => {
    vi.stubEnv('RENDER_GIT_COMMIT', 'c3d0af9dc53cd5aaed4bfaf3d90a16ef02d4ae9f');

    const response = GET(new Request('http://localhost/api/health'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { status: 'ok', revision: 'c3d0af9dc53c' },
    });
  });

  it('uses an explicit unknown marker when no valid revision is available', async () => {
    vi.stubEnv('RENDER_GIT_COMMIT', '');
    vi.stubEnv('GIT_SHA', 'not-a-commit');

    const response = GET(new Request('http://localhost/api/health'));

    await expect(response.json()).resolves.toMatchObject({
      data: { status: 'ok', revision: 'unknown' },
    });
  });
});
