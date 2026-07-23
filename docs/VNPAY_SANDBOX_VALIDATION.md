# VNPay Sandbox Validation Record

## Status

**NEEDS REVIEW - NOT EXECUTED**

No VNPay sandbox merchant credentials or registered public callback URL were
available in the execution environment on 2026-07-23. No transaction ID,
screenshot, webhook, reconciliation result, or approval is claimed.

## Repository Evidence

- Signed IPN/return handling and idempotency tests remain in the payment suite.
- `src/modules/payment/infrastructure/vnpay-query-client.ts` implements signed
  QueryDR requests and verifies signed responses.
- `scripts/verify-vnpay-configuration.ts` rejects non-HTTPS, production/sandbox
  endpoint mismatches and non-canonical return URLs.
- `scripts/payment-reconciliation-report.ts` is bounded and read-only.

## Required Human Execution

1. Provision a dedicated VNPay sandbox merchant.
2. Register the current staging HTTPS return and IPN URLs.
3. Inject credentials from Secrets Manager.
4. Execute every scenario in `PAYMENT_RECONCILIATION_RUNBOOK.md`.
5. Attach redacted provider logs and CloudWatch request IDs.
6. Verify reconciliation and alert delivery.
7. Obtain Finance and Security approval.

Online VNPay must remain disabled for public production traffic until this
record is replaced by real evidence and approvals.
