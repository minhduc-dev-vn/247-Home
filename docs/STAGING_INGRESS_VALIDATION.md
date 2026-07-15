# Staging Ingress Validation

Validation attempt: `2026-07-15T09:02:22Z`

## Result

**BLOCKED: no real HTTPS staging endpoint is configured.**

`STAGING_BASE_URL` is absent. No DNS name, TLS certificate, ingress identity or
network policy was supplied. Localhost, `127.0.0.1` and HTTP loopback were not
used as substitutes.

| Requirement | Result |
|---|---|
| Public staging DNS | NOT AVAILABLE |
| HTTPS endpoint | NOT AVAILABLE |
| TLS handshake/certificate chain | NOT RUN |
| HTTP-to-HTTPS redirect | NOT RUN |
| Application reachability | NOT RUN |
| Secure/HttpOnly/SameSite cookie | NOT RUN OVER HTTPS |
| Trusted ingress strips forwarding headers | NOT VERIFIED |
| `X-Forwarded-Proto` spoof rejection | NOT RUN |
| `X-Forwarded-Host` spoof rejection | NOT RUN |
| CSP | NOT RUN THROUGH INGRESS |
| MIME sniffing protection | NOT RUN THROUGH INGRESS |
| Frame protection | NOT RUN THROUGH INGRESS |
| Referrer/Permissions Policy | NOT RUN THROUGH INGRESS |
| Authenticated `Cache-Control` | NOT RUN THROUGH INGRESS |

The staging Playwright config correctly requires an explicit URL and HTTPS. Its
loopback exception requires explicit opt-in and is limited to local rehearsal;
that exception was not used for this validation attempt.

## Required action

Provision the final HTTPS hostname and approved ingress according to
`STAGING_INGRESS_CONFIGURATION.md`. Prevent direct application-port access,
strip client forwarding headers, set canonical forwarding values, inject final
HTTPS origins, and rerun DNS/TLS/redirect/cookie/header/spoof tests against the
public staging hostname.
