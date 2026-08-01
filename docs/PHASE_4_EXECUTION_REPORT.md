# Phase 4 Execution Report

- **Plan:** [`CURRENT_SYSTEM_REMEDIATION_PLAN.md`](CURRENT_SYSTEM_REMEDIATION_PLAN.md)
- **Executed:** 2026-08-01
- **Scope:** Phase 4 - contain and qualify the VNPay payment flow

## Status

**PHASE 4 REPOSITORY REMEDIATION COMPLETE. EXTERNAL VNPAY SANDBOX QUALIFICATION PENDING OWNER.**

The application now fails closed for public VNPay session creation. `VNPAY_PUBLIC_ENABLED` defaults to `false`; the checkout does not offer online payment and the API returns a structured conflict until a complete VNPay configuration is present and the flag is explicitly enabled. This preserves the plan's immediate policy while the real sandbox merchant, registered HTTPS callback, and Finance/Security/Operations approvals are unavailable.

This report does not claim that a real VNPay sandbox transaction has run. Local tests prove the application protocol and database invariants only; the external-provider acceptance matrix remains pending and public payment must remain disabled.

## Implemented Controls

| Requirement | Implementation | Regression evidence | Result |
| --- | --- | --- | --- |
| One unexpired payable VNPay session per payment | `payment-service.ts` locks the payment row, checks an active `CREATED`/`PENDING` session, then conditionally writes payment/session/audit in one transaction | `payment.test.ts`: `allows only one simultaneous payable session across distinct keys` | PASS |
| Retry-safe same-key request | Same idempotency hash and request fingerprint replay the persisted session; the signed URL uses the persisted `createdAt`, not a new timestamp | `payment.test.ts`: `creates one owner-scoped idempotent payment session` | PASS |
| Safe replacement after expiry | Only expired active sessions are marked `EXPIRED` before a replacement is created; a still-active session is rejected with `ACTIVE_PAYMENT_SESSION` | `payment.test.ts`: `expires a stale session before creating one replacement session` | PASS |
| Safe public enablement | `isVnpayPubliclyEnabled` requires both an explicit public flag and a valid complete provider config; the API and checkout both use it | `vnpay.test.ts`; `payment.test.ts`: `fails closed when public VNPay issuance is disabled` | PASS |
| Signed callback validation | Server validates signature, merchant, reference/session provider, amount, currency, and payment state before a state transition | `payment.test.ts`: valid, tampered-signature, amount, currency, and failed-callback cases | PASS |
| Atomic provider settlement | Conditional payment and order writes, session completion, webhook-event ledger write, and audit event are in one PostgreSQL transaction | `payment.test.ts`: `applies a valid success callback once and atomically confirms the order` | PASS |
| Duplicate callback and second transaction handling | An exact callback reuses the event ledger response. A different provider transaction after payment is terminal is retained as `DUPLICATE` for reconciliation, without a second order transition/audit event | `payment.test.ts`: `records a second provider transaction for a paid order without duplicate audit` | PASS |
| Mismatch evidence | Validly signed amount/currency mismatches are retained as `REJECTED` reconciliation events without changing payment or order state | `payment.test.ts`: amount and currency mismatch cases | PASS |
| Read-only reconciliation | Bounded `1..100` report emits masked stale-session and rejected/duplicate-event exceptions; it does not mutate payments, orders, or refunds | `scripts/payment-reconciliation-report.ts`; code review and integration-backed ledger cases | PASS |
| Public payment UI is gated | Checkout receives a server-derived `onlinePaymentEnabled` value rather than trusting browser configuration | `app/(customer)/checkout/page.tsx`; `payment-flow.spec.ts` test configuration | PASS |

## Transaction Boundaries and Invariants

`createOnlinePaymentSession` holds a database payment lock before inspecting idempotency or active-session state. A new session, any stale-session expiry, the conditional payment version update, and `payment.session_created` audit record all commit or roll back together. Two distinct idempotency keys therefore cannot produce two simultaneously payable URLs.

`processVnpayWebhook` locks the referenced payment and uses the webhook event key as the exact-delivery idempotency ledger. It records signed mismatches and second provider transaction attempts as reconciliation evidence, but only a valid first settlement may conditionally update the payment and its pending-confirmation order. A concurrent or stale write raises a structured conflict and cannot duplicate the audit event.

No Prisma schema or migration was necessary: the existing `PaymentSession`, `PaymentWebhookEvent`, payment version, and audit tables already support this lifecycle. `pnpm db:migrate` confirms the current 17 migrations are deployed without a pending change.

## Files Changed for Phase 4

- `.env.example`
- `app/(customer)/checkout/page.tsx`
- `playwright.config.ts`
- `src/modules/payment/application/payment-service.ts`
- `src/modules/payment/domain/payment-lifecycle.ts`
- `src/modules/payment/infrastructure/vnpay.ts`
- `scripts/payment-reconciliation-report.ts`
- `tests/unit/payment-lifecycle.test.ts`
- `tests/unit/vnpay.test.ts`
- `tests/integration/payment.test.ts`
- `tests/e2e/payment-flow.spec.ts`
- `docs/API_CONTRACT.md`
- `docs/ORDER_STATE_MACHINE.md`
- `docs/VNPAY_SANDBOX_VALIDATION.md`
- `docs/PAYMENT_RECONCILIATION_RUNBOOK.md`
- `docs/PHASE_4_EXECUTION_REPORT.md`

Some files above were already modified in the dirty worktree before this phase. This phase only adds the payment-session, public-enablement, callback-ledger, reconciliation, test, and documentation changes described here; it does not revert unrelated work.

## Verification

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | PASS - 17 migrations, no pending migration |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS - 39 files, 193 tests |
| `pnpm test:integration` | PASS - 12 PostgreSQL-backed files, 105 tests |
| `pnpm test:migration` | PASS - current valid history and invalid-history rollback checks |
| `pnpm test:e2e` | PASS - 50 tests, started from fresh source after final `db:migrate` |
| `pnpm build` | PASS |
| Touched-file Prettier check | PASS |
| `pnpm format:check` | FAIL - 75 pre-existing files outside Phase 4; no Phase 4 file is listed |

The E2E test environment intentionally sets `VNPAY_PUBLIC_ENABLED=true` with test-only provider values so `payment-flow.spec.ts` can exercise the customer flow. Runtime defaults remain disabled in `.env.example` and any incomplete provider configuration remains disabled even if the flag is accidentally enabled.

## External Sandbox Qualification and Required Approval

The following cannot be truthfully marked PASS without a VNPay sandbox merchant account, registered HTTPS return/IPN endpoints, and named owners. They are tracked in [`VNPAY_SANDBOX_VALIDATION.md`](VNPAY_SANDBOX_VALIDATION.md):

1. A real sandbox success callback, cancellation, delay/retry, duplicate delivery, mismatch, and provider-outage case.
2. Review of the returned provider responses and the bounded reconciliation report against those real callbacks.
3. Finance approval of reconciliation ownership and treatment of a second provider transaction.
4. Security approval of callback endpoint exposure, secret custody, and log redaction.
5. Operations approval of the runbook and public enablement window.

Until all five are evidenced and approved, leave `VNPAY_PUBLIC_ENABLED=false`. Do not add live or sandbox credentials to the repository, logs, reports, browser environment, or Playwright configuration.

## Residual Risks

1. **External VNPay behavior is unqualified.** The application is safely disabled, but real provider callbacks, outage semantics, and dashboard/reconciliation behavior need sandbox evidence before public payment can be offered.
2. **Repository-wide formatting remains red.** `pnpm format:check` currently reports 75 non-Phase-4 files. This is the existing Phase 7 formatting baseline item; it still blocks a claim that every global quality gate is green.
3. **The Prisma configuration warning remains.** `package.json#prisma` is deprecated before Prisma 7. This is tracked as Phase 7 M-07 and was not changed within payment scope.
4. **The storefront has an LCP-image advisory.** Fresh E2E passed, but Next.js reported that `/assets/images/products/khoa-cua-l2.png` is the LCP image without eager loading. It is not a payment correctness issue, but should be addressed in a scoped performance task.

## Conclusion

Phase 4 is complete at repository level: online payment cannot be publicly enabled by incomplete configuration, session issuance has transactional exclusivity, callbacks are idempotent and reconciliation-safe, and current local PostgreSQL/unit/E2E/build evidence passes. The project is **not** authorized to expose VNPay publicly until the external sandbox matrix and Finance, Security, and Operations approvals are complete.
