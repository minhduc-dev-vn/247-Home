import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function source(path: string) {
  return readFile(path, 'utf8');
}

describe('production ingress infrastructure', () => {
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
});
