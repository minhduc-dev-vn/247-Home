# VNPay Reconciliation Runbook

## Boundary

`pnpm payment:reconcile` is read-only. It selects at most
`RECONCILIATION_LIMIT` records (default `50`, maximum `100`) across stale
VNPay sessions and retained rejected/duplicate callback events. It uses signed
QueryDR only for stale sessions and emits masked references. It never changes
payments, orders, inventory, refunds, sessions, or audit history.

The retained webhook ledger is the reconciliation evidence source:

- `REJECTED`: signed amount/currency or local provider-contract mismatch.
- `DUPLICATE`: exact-state replay, late terminal callback, or a second provider
  transaction after a paid payment. The report classifies the latter as
  `SECOND_PROVIDER_TRANSACTION`.

## Required Configuration

Inject `DATABASE_URL`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`,
`VNPAY_QUERY_URL`, and `VNPAY_RECONCILIATION_IP` through the approved secret
manager. Do not pass secret values on a command line or record them in logs.
Run the command from a private task that can reach the target database and
VNPay endpoint.

`VNPAY_PUBLIC_ENABLED` must remain `false` during qualification. It can be
enabled only after the sandbox evidence and required approvals in
[`VNPAY_SANDBOX_VALIDATION.md`](VNPAY_SANDBOX_VALIDATION.md) are complete.

## Operation

1. Confirm the reviewed release SHA, migration state, and database backup
   according to the database runbook.
2. Run `pnpm verify:vnpay-config` in the target environment.
3. Run `pnpm payment:reconcile` with an approved bounded limit.
4. Archive structured output under the release or incident identifier. Keep
   only masked references, response codes, transaction status, and request IDs.
5. Treat each `payment.reconciliation.discrepancy`,
   `payment.reconciliation.exception`, or
   `payment.reconciliation.provider_error` as an investigation item.
6. Finance decides any payment correction, refund, or customer communication.
   The script and application must not auto-correct payment/order state.

A non-zero exit is an operational failure and must alert the payment owner.

## Exception Handling

1. Preserve the original payment, order, session, webhook-event, and audit
   records. Do not delete or rewrite them to make a report green.
2. Correlate the masked provider reference with the provider console in a
   restricted operational context.
3. For `SECOND_PROVIDER_TRANSACTION`, freeze public VNPay issuance if needed,
   open a Finance/Security incident, and resolve through approved accounting
   policy. Do not auto-refund or re-confirm the order.
4. For amount/currency mismatch or provider outage, keep the order unpaid until
   a signed provider result and approved reconciliation determine the outcome.

## Rollback

Set `VNPAY_PUBLIC_ENABLED=false` at the approved configuration boundary to stop
new hosted-payment links. Existing signed IPNs remain eligible for server-side
validation. Never weaken signature verification, bypass current-state checks,
or rewrite payment history as a rollback shortcut.
