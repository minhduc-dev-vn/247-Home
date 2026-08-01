# Security Incident and Recovery Runbook

## Scope

This runbook covers exposed credentials, password-reset delivery failures and
the Phase 2 password-reset outbox. It never authorizes direct edits to user,
password, token or audit tables.

## Password-reset delivery outage

1. Keep `POST /api/v1/auth/forgot-password` available. Its generic `202`
   response prevents account enumeration and does not prove delivery.
2. Inspect only structured worker/request IDs and aggregate counts. Do not copy
   reset URLs, token values, email bodies, provider authorization headers or
   recipient addresses into tickets or logs.
3. Run the bounded worker from the approved runtime environment:

   ```powershell
   pnpm password-reset:deliver -- --limit 20
   ```

4. A non-zero exit means one or more rows were not delivered. Fix the provider
   configuration/connectivity, then rerun the worker. `PENDING`, `PROCESSING`,
   `FAILED` and `CANCELLED` rows cannot reset a password.
5. After five failed worker claims, the row is `CANCELLED` and its token is
   consumed. The customer must request a new reset link; do not revive the old
   token manually.
6. Verify recovery with a synthetic account: one worker delivery becomes
   `DELIVERED`, one reset succeeds, a replay is rejected and `authVersion`
   increases once.

## Credential exposure

1. Treat a disclosed database, mail-provider or Auth.js credential as exposed.
2. Rotate it in the owning provider, update only the secret store, and revoke
   the old value. Never paste the replacement in a shell transcript, Git,
   documentation, issue or screenshot.
3. For `NEXTAUTH_SECRET`, plan a short recovery window: pending encrypted reset
   payloads become unusable and users must issue new requests. Confirm current
   sessions/recovery policy with the identity owner before rotation.
4. Record timestamps, owner, affected environment and request IDs in the
   restricted incident system. Do not store secret values there.

## Verification and forward fix

- Confirm `/api/ready` is healthy before and after recovery.
- Confirm the worker has a production mailer configuration and a scheduler.
- Run the Phase 2 migration upgrade test and identity integration tests on an
  isolated database before any shared-environment forward fix.
- Never use `prisma migrate reset`, table drop, truncate or manual token backfill
  to repair this flow.
