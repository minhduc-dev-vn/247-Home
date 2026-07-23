import { isIP } from 'node:net';

function cloudFrontAddress(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  const bracketedIpv6 = /^\[([^\]]+)\]:\d+$/.exec(normalized)?.[1];
  if (bracketedIpv6 && isIP(bracketedIpv6)) return bracketedIpv6;

  const ipv4WithPort = /^([^:]+):\d+$/.exec(normalized)?.[1];
  if (ipv4WithPort && isIP(ipv4WithPort)) return ipv4WithPort;
  return isIP(normalized) ? normalized : null;
}

export function trustedClientAddress(
  request: Request,
  fallback = 'untrusted-client',
): string {
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return fallback;
  if (process.env.TRUSTED_PROXY_PROVIDER !== 'cloudfront') return fallback;
  return (
    cloudFrontAddress(request.headers.get('x-247-client-address')) ?? fallback
  );
}
