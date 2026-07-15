import { afterAll, describe, expect, it } from 'vitest';

import { GET } from '../../app/api/ready/route';
import { prisma } from '@/shared/db/client';

describe('GET /api/ready', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reports ready when PostgreSQL is reachable', async () => {
    const response = await GET(new Request('http://localhost/api/ready'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toMatchObject({
      data: { status: 'ready' },
    });
  });
});
