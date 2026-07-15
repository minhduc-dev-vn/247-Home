# ADR-001: Local Credentials Authentication

- Status: Accepted by the approved Identity and Access slice on 2026-07-13.
- Owner: Task owner and technical reviewer.

## Context

The identity slice requires registration, password login, password reset, session invalidation and local email simulation. Production identity provider, MFA and recovery policy are still open decisions.

## Decision

- Use Auth.js `Credentials` provider for development and test only.
- Store bcrypt password hashes in PostgreSQL; never store or return plaintext passwords.
- Use Auth.js JWT sessions only in `HttpOnly`, `SameSite=Lax` cookies, with `Secure` enabled in production mode.
- Include `authVersion` in the session token and compare it to PostgreSQL in every server guard. Password reset and future role mutation increment the version.
- Use a local filesystem outbox outside version control for reset email simulation. It is unavailable in production mode.
- Seed only synthetic admin/customer accounts outside production.

## Consequences

- Credentials provider does not require Auth.js adapter/session tables, so Slice 2 owns only `users`, `roles`, `user_roles` and one-time reset-token hashes.
- In-memory rate limiting only protects the local single-process environment. A shared rate-limit store is required before production.
- Production provider, MFA, retention, reset email delivery and CSP nonce policy require a follow-up security review.

## Rollback

Disable identity routes and revert application code while preserving identity rows. Do not drop user/role/reset-token tables. Any schema correction uses a forward migration; existing password hashes remain unreadable and are never converted to plaintext.
