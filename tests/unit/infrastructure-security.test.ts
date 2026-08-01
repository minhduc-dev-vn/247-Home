import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function source(path: string) {
  return readFile(path, 'utf8');
}

describe('production ingress infrastructure', () => {
  it('generates the demo Prisma client without requiring a runtime secret', async () => {
    const dockerfile = await source('Dockerfile');
    const demoToolsStart = dockerfile.indexOf(
      'FROM dependencies AS demo-tools',
    );
    const runtimeStart = dockerfile.indexOf('\nFROM node:', demoToolsStart);
    const demoToolsStage = dockerfile.slice(demoToolsStart, runtimeStart);

    expect(demoToolsStart).toBeGreaterThanOrEqual(0);
    expect(runtimeStart).toBeGreaterThan(demoToolsStart);
    expect(demoToolsStage).toContain(
      'DATABASE_URL=postgresql://build-only:build-only@127.0.0.1:5432/build-only',
    );
    expect(demoToolsStage.indexOf('DATABASE_URL=')).toBeLessThan(
      demoToolsStage.indexOf('RUN pnpm db:generate'),
    );
  });

  it('uses WAF block mode in production and covers real auth paths', async () => {
    const [production, waf] = await Promise.all([
      source('infrastructure/environments/production/main.tf'),
      source('infrastructure/modules/waf/main.tf'),
    ]);
    expect(production).toContain(
      'waf_rate_rule_action                   = "block"',
    );
    expect(waf).toContain('search_string         = "/api/auth/"');
    expect(waf).toContain('search_string         = "/api/v1/auth/"');
    expect(waf).toContain('name     = "api-mutation-rate-limit"');
    expect(waf).toContain('response_code = 429');
    expect(waf).toContain('name  = "Retry-After"');
    expect(waf).toContain('aggregate_key_type    = "IP"');
  });

  it('overwrites the trusted client address at CloudFront', async () => {
    const cloudFront = await source(
      'infrastructure/modules/cloudfront/main.tf',
    );
    expect(cloudFront).toContain(
      "event.request.headers['x-247-client-address']",
    );
    expect(cloudFront).toContain('event.viewer.ip');
    expect(cloudFront).toContain('event_type   = "viewer-request"');
  });

  it('limits direct-origin access to CloudFront and requires an origin secret', async () => {
    const [security, ecs, cloudFront] = await Promise.all([
      source('infrastructure/modules/security/main.tf'),
      source('infrastructure/modules/ecs/main.tf'),
      source('infrastructure/modules/cloudfront/main.tf'),
    ]);
    expect(security).toContain('cloudfront.origin-facing');
    expect(ecs).toContain('http_header_name = "X-Origin-Verify"');
    expect(cloudFront).toContain('name  = "X-Origin-Verify"');
  });
});
