# VNPay Reconciliation Runbook

## Boundary

`pnpm payment:reconcile` is read-only. It queries bounded stale pending VNPay
sessions, verifies signed QueryDR responses, compares identity, amount and paid
state, and emits structured results. It never changes payments, orders,
inventory, refunds, or audit history.

## Required Secrets and Configuration

Inject `DATABASE_URL`, `VNPAY_TMN_CODE`, and `VNPAY_HASH_SECRET` from the
approved secret manager. Configure the HTTPS sandbox or production
`VNPAY_QUERY_URL`. Do not pass secret values on a command line or record them in
logs.

## Operation

1. Run `pnpm verify:vnpay-config` in the target environment.
2. Run `pnpm payment:reconcile` from a private task with database access.
3. Archive structured logs under the release/run identifier.
4. Investigate every `payment.reconciliation.discrepancy` and
   `payment.reconciliation.provider_error`.
5. Finance decides the corrective action; the script must not auto-correct.

A non-zero exit is an operational failure and must alert the payment owner.

## Required Sandbox Qualification

Record successful, failed, cancelled, delayed, duplicate-IPN, replayed-return,
tampered-signature, and amount-mismatch scenarios. For each case retain only
masked references, provider timestamps, signed-response result, local
payment/order version, audit event count, and operator approval.

## Rollback

Disable online VNPay at the approved feature/configuration boundary if
reconciliation or callback validation is unhealthy. COD/manual payment remains
subject to its existing server-side rules. Never weaken signature verification
or rewrite payment history to recover service.
