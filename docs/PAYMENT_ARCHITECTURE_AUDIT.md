# Payment Architecture Audit

## Scope and current state

247 Home is a Next.js modular monolith. Checkout, orders, inventory,
appointments, and the original manual payment workflow are owned by
`src/modules/commerce`. There were no separate `orders`, `checkout`, or
`payment` folders before this work; the audited equivalents are the commerce
application service, Prisma models, API routes, and Operations guards.

The original checkout transaction already had strong foundations:

1. Re-read price and stock from PostgreSQL.
2. Lock cart, inventory, and installation capacity.
3. Create order, item snapshots, one `PENDING` payment, inventory allocations,
   and an appointment in one transaction.
4. Close the cart and bind the checkout idempotency record.

Manual bank transfer and COD were represented by `payments`. Authorized staff
could conditionally update a payment using its id, expected version, and
expected status. Technician start/completion and order completion already had
server-side payment guards.

## Missing capabilities

- No online provider, payment session, signed redirect, or verified webhook.
- No provider transaction identifier or paid/failed timestamps.
- No replay-safe provider event ledger.
- Browser return data could not be reconciled with server payment state.
- Checkout always navigated directly to order confirmation.
- `ADR-013` intentionally froze the MVP at COD/manual transfer and therefore
  had to be explicitly superseded for online payment.

## Recommended architecture

```text
Checkout transaction
  -> Order + VNPAY Payment(PENDING)
  -> POST /api/v1/payment/create (owner + idempotency)
  -> PaymentSession + signed VNPay URL
  -> VNPay hosted payment page
  -> signed IPN /api/v1/payment/webhook
  -> PostgreSQL transaction
       Payment PROCESSING -> PAID/FAILED
       Order PENDING_CONFIRMATION -> CONFIRMED (success only)
       PaymentSession terminal state
       append-only PaymentWebhookEvent
       AuditLog
  -> browser return reads database status only
```

The gateway adapter contains protocol formatting and HMAC verification only.
Application services own authorization, idempotency, locks, lifecycle, and
transactions. Routes own bounded HTTP parsing and response mapping. No network
request is made inside a database transaction.

## Database changes

- Add `VNPAY` payment method.
- Add `CREATED` and `PROCESSING` lifecycle values while preserving existing
  values.
- Add allowlisted provider metadata and lifecycle timestamps to `payments`.
- Add idempotent `payment_sessions` with unique provider references.
- Add append-only `payment_webhook_events` with a unique signed-event hash.

The migration is forward-only and does not rewrite existing COD or bank
transfer rows.

## Security risks and controls

| Risk | Control |
| --- | --- |
| Forged success | HMAC-SHA512 verified before database access |
| Browser status tampering | Return URL never mutates payment/order |
| Replay | Unique event key, session idempotency, row lock, conditional version write |
| Amount substitution | Compare signed `vnp_Amount` with DB amount multiplied by 100 |
| IDOR | Create/read queries include authenticated customer owner |
| Staff bypass | Manual transition policy rejects `VNPAY` |
| Partial state | Payment, order, session, event, and audit update in one transaction |
| Secret exposure | Environment variables only; payload/audit allowlists exclude secret and signature |
| Provider outage | Order remains visible and payment remains pending/failed; no fake success |

## Audit conclusion

The existing transaction and state-machine model is suitable for an online
gateway. A separate payment module is warranted because provider protocol and
webhook concerns are distinct from checkout orchestration. The order and
inventory architecture does not need to change.
