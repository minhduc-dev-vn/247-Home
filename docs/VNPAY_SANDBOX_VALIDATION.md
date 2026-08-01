# VNPay Sandbox Validation Record

## Status

**REPOSITORY CONTROLS IMPLEMENTED - EXTERNAL SANDBOX VALIDATION PENDING OWNER**

No VNPay sandbox merchant credential, registered public HTTPS IPN URL, or
provider transaction is available in this repository environment. No sandbox
transaction, screenshot, webhook, reconciliation result, or approval is
claimed here. `VNPAY_PUBLIC_ENABLED` defaults to `false`, so customer checkout
and direct session creation fail closed until this record contains real
evidence and the required approvals.

## Repository Evidence

- `src/modules/payment/application/payment-service.ts` locks each payment and
  allows one unexpired payable VNPay session. A stale session becomes
  `EXPIRED` only in the same transaction that creates its replacement.
- The append-only `payment_webhook_events` ledger records processed, rejected,
  and reconciliation duplicate callbacks. Exact signed replay does not create
  another payment/order transition or audit record.
- `scripts/verify-vnpay-configuration.ts` rejects unsafe URL and environment
  combinations without logging secret values.
- `scripts/payment-reconciliation-report.ts` is bounded and read-only. It
  checks stale sessions through signed QueryDR and reports retained rejected or
  duplicate callback evidence using masked references.
- Local PostgreSQL integration and Playwright coverage provide automated
  evidence only; they are not substitutes for a real provider transaction.

## Mandatory External Matrix

| Scenario | Evidence required | Status |
| --- | --- | --- |
| Successful payment/IPN | Redacted provider record, local payment/order versions, one audit event | PENDING OWNER |
| Customer cancellation or failed payment | Provider result, local `FAILED` state, no order confirmation | PENDING OWNER |
| Delayed IPN after local expiry | Signed callback, session/payment result, reconciliation outcome | PENDING OWNER |
| Exact duplicate IPN | Two callback request IDs, one processed ledger event, one audit | PENDING OWNER |
| Second provider transaction for a paid order | Duplicate ledger entry and reconciliation report output; no duplicate audit | PENDING OWNER |
| Tampered signature | Provider-safe HTTP response and no database mutation | PENDING OWNER |
| Amount or currency mismatch | `RspCode=04`, rejected ledger entry, no payment/order mutation | PENDING OWNER |
| QueryDR/provider outage | Bounded reconciliation error output and alert delivery | PENDING OWNER |

## Required Human Execution

1. Provision a dedicated VNPay sandbox merchant and register the current
   staging HTTPS return/IPN URLs.
2. Inject only `VNPAY_TMN_CODE` and `VNPAY_HASH_SECRET` through the approved
   secret manager; do not place them in source, command history, or evidence.
3. Run `pnpm verify:vnpay-config` in staging before any transaction.
4. Execute every scenario in the matrix and archive redacted provider records
   with server request IDs and the reviewed release SHA.
5. Run `pnpm payment:reconcile` from a private task with database access and
   verify its alert route for a non-zero exit.
6. Obtain written Finance, Security, and Operations approval before setting
   `VNPAY_PUBLIC_ENABLED=true` for public traffic.

## Public Enablement Rule

Online VNPay must remain disabled for public traffic until this document is
replaced by real, redacted sandbox evidence and all three approvals are
recorded. Disabling the gate is the rollback action for new payment links; it
does not weaken IPN validation or rewrite payment history.
