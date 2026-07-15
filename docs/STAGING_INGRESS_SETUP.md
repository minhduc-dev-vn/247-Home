# Staging HTTPS Ingress Setup

## Provisioning contract

Provision a dedicated staging DNS name with a trusted TLS certificate. HTTP
must redirect to HTTPS before authenticated content is served. Require TLS 1.2
or later, monitor certificate renewal and block direct access to port 3000.

Set `NEXTAUTH_URL` and `APP_ORIGIN` to the exact HTTPS origin. Enable
`TRUST_PROXY_HEADERS=true` only when the ingress strips client-supplied
`Forwarded`, `X-Forwarded-*` and `X-Real-IP` headers, then writes canonical
values from the actual connection.

Preserve application CSP, frame protection, MIME-sniffing protection,
referrer/permissions policy, cache controls and request IDs. Add HSTS only after
HTTPS and rollback routing have been verified.

## Validation

- DNS resolves to the approved ingress and the certificate chain/hostname is
  valid.
- HTTP performs only a redirect to HTTPS.
- `/api/health` and `/api/ready` return 200 through HTTPS.
- Login cookies are `Secure`, `HttpOnly`, and `SameSite=Lax`.
- Same-origin mutation succeeds; foreign Origin is rejected.
- Spoofed forwarding headers do not alter origin or client attribution.
- Direct application-port access is denied.
- Authenticated responses preserve `Cache-Control: private, no-store`.
- `pnpm test:e2e:staging` passes with retries disabled.

Loopback HTTP is a rehearsal option in Playwright and never satisfies this
check. No staging DNS, certificate or ingress is bound in this environment.

