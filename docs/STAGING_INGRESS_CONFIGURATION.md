# Staging Ingress Configuration

Version: 2026-07-15

## Traffic contract

- The public staging origin is HTTPS only. HTTP redirects to HTTPS before the
  application and never serves authenticated content.
- TLS 1.2 or later is required. Certificate issuance, renewal and monitoring
  belong to the approved ingress platform.
- `NEXTAUTH_URL` and `APP_ORIGIN` contain the exact final HTTPS origin.
- Auth cookies remain `Secure`, `HttpOnly` and `SameSite=Lax`.
- HSTS is enabled at ingress only after HTTPS routing and rollback behavior are
  verified for the staging hostname.

## Trusted proxy boundary

`TRUST_PROXY_HEADERS` stays `false` unless the application is reachable only
through an approved ingress that removes client-supplied forwarding headers and
writes canonical values.

When enabled, ingress must:

1. Remove incoming `Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host`,
   `X-Forwarded-Proto` and `X-Real-IP` values.
2. Set `X-Forwarded-Proto: https` from the terminated TLS connection.
3. Set `X-Forwarded-Host` to the allowlisted staging host.
4. Append only platform-observed client addresses to `X-Forwarded-For`.
5. Prevent direct network access to the application port.

The application must not trust forwarding headers from a public client. This is
required for origin validation and rate-limit attribution.

## Required headers

Ingress must preserve application CSP, `X-Content-Type-Options`, frame
protection, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control` and
`X-Request-Id`. It may add HSTS and platform request IDs, but must not weaken or
duplicate CSP with conflicting directives.

## Validation

- HTTP receives only an HTTPS redirect and no session cookie.
- HTTPS health/readiness return 200 without exposing host or credentials.
- Login sets `Secure`, `HttpOnly`, `SameSite=Lax` session cookies.
- A valid same-origin mutation succeeds.
- A foreign Origin receives 403.
- Spoofed forwarding headers do not change origin or rate-limit identity.
- Direct application-port access is denied by network policy.
- CSP, frame protection, MIME sniffing protection and private/no-store API
  headers remain present through ingress.

`playwright.staging.config.ts` requires an explicit `STAGING_BASE_URL` and HTTPS.
HTTP is accepted only for an explicitly enabled loopback rehearsal and never
counts as public ingress validation.
