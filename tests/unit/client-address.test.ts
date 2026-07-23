import { afterEach, describe, expect, it } from 'vitest';

import { trustedClientAddress } from '@/shared/http/client-address';

const originalTrust = process.env.TRUST_PROXY_HEADERS;
const originalProvider = process.env.TRUSTED_PROXY_PROVIDER;

afterEach(() => {
  if (originalTrust === undefined) delete process.env.TRUST_PROXY_HEADERS;
  else process.env.TRUST_PROXY_HEADERS = originalTrust;
  if (originalProvider === undefined) delete process.env.TRUSTED_PROXY_PROVIDER;
  else process.env.TRUSTED_PROXY_PROVIDER = originalProvider;
});

describe('trustedClientAddress', () => {
  it('ignores forwarding headers when proxy trust is disabled', () => {
    process.env.TRUST_PROXY_HEADERS = 'false';
    expect(
      trustedClientAddress(
        new Request('https://example.test', {
          headers: {
            'x-247-client-address': '198.51.100.20',
            'x-forwarded-for': '203.0.113.99',
          },
        }),
      ),
    ).toBe('untrusted-client');
  });

  it('accepts only the CloudFront-overwritten client header', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUSTED_PROXY_PROVIDER = 'cloudfront';
    expect(
      trustedClientAddress(
        new Request('https://example.test', {
          headers: {
            'x-247-client-address': '198.51.100.20',
            'x-forwarded-for': '203.0.113.99',
          },
        }),
      ),
    ).toBe('198.51.100.20');
  });

  it('parses CloudFront IPv4 and bracketed IPv6 ports and rejects garbage', () => {
    process.env.TRUST_PROXY_HEADERS = 'true';
    process.env.TRUSTED_PROXY_PROVIDER = 'cloudfront';
    expect(
      trustedClientAddress(
        new Request('https://example.test', {
          headers: { 'x-247-client-address': '198.51.100.20:443' },
        }),
      ),
    ).toBe('198.51.100.20');
    expect(
      trustedClientAddress(
        new Request('https://example.test', {
          headers: { 'x-247-client-address': '[2001:db8::1]:443' },
        }),
      ),
    ).toBe('2001:db8::1');
    expect(
      trustedClientAddress(
        new Request('https://example.test', {
          headers: { 'x-247-client-address': 'not-an-ip' },
        }),
      ),
    ).toBe('untrusted-client');
  });
});
