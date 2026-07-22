# Payment Implementation Report

## Status

**247 HOME ONLINE PAYMENT SYSTEM READY** for repository integration and VNPay
sandbox onboarding. A real external sandbox transaction still requires a
merchant `TmnCode` and `HashSecret` issued by VNPay; no credential or fake
success is stored in this repository.

## Architecture

The payment slice is implemented as a module with three boundaries:

- `domain`: lifecycle decisions independent of HTTP and Prisma.
- `infrastructure`: VNPay v2.1 canonical encoding, HMAC-SHA512, timestamp
  conversion, configuration, and event fingerprinting.
- `application`: owner scope, idempotent session creation, row locks,
  optimistic versions, webhook reconciliation, order integration, and audit.

Checkout continues to create order/payment/inventory/appointment atomically.
For `VNPAY`, the browser then requests an idempotent payment session and is
redirected to VNPay. The signed server IPN is the only path to `PAID`.

## Gateway

VNPay API v2.1 was selected for the first online adapter. The decision and
provider comparison are in `PAYMENT_GATEWAY_DECISION.md`. COD and manual bank
transfer remain compatible. Manual staff actions explicitly reject VNPay.

## API contract

- `POST /api/v1/payment/create`: owner-scoped session creation; bounded JSON,
  origin/rate-limit protection, and required `Idempotency-Key`.
- `GET /api/v1/payment/{id}`: owner-scoped payment status and allowlisted
  transaction information; private/no-store.
- `GET|POST /api/v1/payment/webhook`: bounded VNPay signed fields. GET matches
  VNPay v2.1 IPN; POST accepts signed JSON/form payloads for compatible proxy
  delivery.
- `GET /api/v1/payment/return`: verifies return signature, reads database
  status, and redirects to success/failure/pending. It never mutates state.

## Lifecycle and transaction boundary

Online lifecycle values are `CREATED`, `PENDING`, `PROCESSING`, `PAID`,
`FAILED`, `CANCELLED`, and `REFUNDED`. Existing checkout creates a pending
payment. Session creation conditionally changes it to processing.

A valid webhook transaction includes:

1. Lock payment row.
2. Reject duplicate signed event.
3. Verify database amount/currency and current lifecycle.
4. Conditionally update payment using id, version, and current status.
5. Complete/fail the payment session.
6. On success, conditionally confirm a pending order using id, version, and
   current status.
7. Insert append-only provider event and audit row.

Any error rolls back all seven effects. Duplicate delivery does not increment
versions or create another audit event.

## Security

- HMAC-SHA512 verified before payment lookup or mutation.
- Constant-time signature comparison.
- Signed amount equals database VND amount multiplied by 100.
- Merchant code, reference, provider transaction id, and result codes checked.
- Customer create/read is owner-scoped; another customer receives not found.
- Browser return/query parameters cannot mark payment paid.
- Secrets are lazy-loaded from environment and excluded from response/audit.
- Payment/order/session/event/audit mutation is atomic.
- Technician and order state guards still require paid payment where defined.

## Database

Migration `20260722120000_online_payment_vnpay` adds lifecycle enum values,
provider metadata, `payment_sessions`, and `payment_webhook_events`. Existing
COD/bank rows are not rewritten. The first local migration attempt exposed
PostgreSQL error `55P04` when a new enum value was used in a same-transaction
check; the transaction rolled back, the redundant checks were removed, Prisma
marked the attempt rolled back, and the corrected migration applied cleanly.

## Frontend

- Checkout shows VNPay only when merchant code and hash secret are configured.
- Session creation redirects to the provider URL.
- Failed session setup preserves the created order and opens pending status.
- `/payment/success`, `/payment/failure`, and `/payment/pending` render
  database-authoritative state and remain in CustomerLayout.
- Order detail shows method, status, amount, public transaction reference, and
  paid timestamp without gateway internals.

## Tests and results

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | PASS; 15 migrations, online payment migration applied |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS; 27 files / 95 tests |
| `pnpm test:integration` | PASS; 10 files / 68 tests |
| `pnpm test:e2e` | PASS; 47/47 on a fresh dev server after migration |
| `pnpm build` | PASS; production build includes all payment routes/pages |

Regression coverage includes session idempotency, owner scope, manual VNPay
confirmation denial, signed success/failure, invalid signature, amount
mismatch, concurrent duplicate callback, one version/audit update, order
confirmation, provider redirect, and customer result UI. Existing Operations
tests continue to prove unpaid installation actions are rejected.

## Refund preparation

`REFUNDED` and `refundedAt` are represented, but the refund endpoint remains
intentionally disabled. Activating `POST /payment/{id}/refund` requires an
approved authorization matrix, full/partial refund rules, accounting
reconciliation, idempotency, and VNPay query/refund credentials. No generic
status mutation is exposed as a substitute.

## Limitations and release checklist

- Obtain separate VNPay sandbox and production merchant credentials.
- Register the public HTTPS IPN and return URLs with VNPay.
- Run one real sandbox success, failure/cancel, duplicate IPN, and delayed-IPN
  scenario before production approval.
- Use a distributed rate limiter for multi-instance production deployment; the
  current repository rate limiter is process-local.
- Add scheduled reconciliation/alerting for processing payments older than the
  session expiry before production traffic.
- Rotate any credential ever shared outside the deployment secret manager.
