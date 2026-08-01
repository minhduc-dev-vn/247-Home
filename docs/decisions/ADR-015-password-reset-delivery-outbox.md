# ADR-015: Password Reset Delivery Outbox

- Status: Accepted for the Phase 2 release candidate on 2026-07-28.
- Owner: Identity and release reviewers.

## Context

The original reset flow inserted a usable token, then attempted to write a
local-development email file. The adapter intentionally failed in production,
which made a known account receive a 500 response and could leave a usable token
that had never been delivered.

## Decision

- Create the password-reset token hash and one delivery outbox row in the same
  PostgreSQL transaction.
- Persist the raw token only as AES-256-GCM encrypted outbox payload. The key is
  derived server-side from `NEXTAUTH_SECRET`; plaintext tokens are never logged
  or returned by the API.
- Reset completion requires the delivery row to be `DELIVERED`. Pending, failed,
  cancelled and legacy pre-outbox tokens fail closed.
- Deliver outbox rows asynchronously with `pnpm password-reset:deliver`. The
  worker claims rows conditionally, applies a lease, retries bounded failures and
  cancels the token after the final failure.
- Use the Resend HTTPS API as the production adapter without adding an SDK
  dependency. It requires `PASSWORD_RESET_MAILER=resend`, `RESEND_API_KEY` and
  `PASSWORD_RESET_FROM` only in the runtime secret store. Development/test use
  `PASSWORD_RESET_MAILER=local` and `.local-outbox/`.
- Keep outbound network activity outside all database transactions.

## Consequences

- The forgot-password endpoint returns the same accepted response for valid
  known, unknown and inactive email addresses. It does not call a mail provider
  inline.
- A scheduler or Render Cron Job must run the worker with the same protected
  runtime environment. A non-zero worker exit requires alerting because queued
  messages remain unusable until a later successful delivery.
- Rotating `NEXTAUTH_SECRET` makes existing encrypted outbox payloads
  undecryptable. They remain unusable, are retried/cancelled safely, and users
  must request a new link. Rotate only through the approved identity incident
  process.
- There is no new production dependency. The Resend adapter uses the Node.js
  platform `fetch` API; rollback is to disable the recovery endpoint/worker and
  forward-fix application code, not to delete outbox history.

## Security and rollback

Do not downgrade to the pre-outbox reset implementation after the migration: it
would not require a confirmed delivery row and could make legacy pending tokens
usable. Prefer a forward fix. If application rollback is unavoidable, disable
password recovery at the ingress until the forward-compatible application is
restored. Do not drop the enum/table or delete reset/audit history as a rollback
shortcut.
