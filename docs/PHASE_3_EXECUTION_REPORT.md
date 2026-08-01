# Phase 3 Execution Report

- **Plan:** [`CURRENT_SYSTEM_REMEDIATION_PLAN.md`](CURRENT_SYSTEM_REMEDIATION_PLAN.md)
- **Executed:** 2026-07-29
- **Scope:** Phase 3 - release unpaid order inventory and appointment capacity

## Status

**PHASE 3 REPOSITORY REMEDIATION COMPLETE.** Eligible unpaid orders can now be cancelled or explicitly expired through one server-side transition policy. Inventory, appointment capacity, payment state, order state, and audit commit in one PostgreSQL transaction. This is not an approval for automatic expiry scheduling, customer notifications, or a production payment reconciliation policy.

## Implemented Policy

| Action | Allowed actor and source state | Mandatory guards | Atomic effects |
| --- | --- | --- | --- |
| `cancel` | CUSTOMER owner: `PENDING_CONFIRMATION`; STAFF: `PENDING_CONFIRMATION` or `CONFIRMED`; MANAGER/ADMIN: also `PROCESSING` | expected version, `RESERVED` inventory, unpaid/non-refunded payment, no payable online session, allowed appointment state | release allocation and reserved stock, release capacity once, cancel eligible unpaid payment, conditional order update, audit |
| `expire` | MANAGER/ADMIN only, `PENDING_CONFIRMATION` | same guards plus explicit bounded cutoff | same effects and `order.expire` audit |

Customer cancellation is owner-scoped in the database and returns `404` for an out-of-scope order. The request cannot provide a next state, price, stock, payment state, or slot count. A stale request returns `409` and cannot release a resource twice.

`expire` is a manual operational action, not an implicit timer. It requires an active manager/admin CUID, an explicit UTC cutoff, a 1-100 limit (default 25), and a reason:

```powershell
pnpm orders:expire -- --actor-id <manager-or-admin-cuid> --before 2026-07-29T00:00:00Z --dry-run
pnpm orders:expire -- --actor-id <manager-or-admin-cuid> --before 2026-07-29T00:00:00Z --limit 25 --reason "Approved unpaid-order expiry run INC-123"
```

## Requirement Matrix

| Requirement | Implementation | Regression evidence | Result |
| --- | --- | --- | --- |
| Central policy | `src/modules/commerce/domain/order-transition.ts` | `tests/unit/order-transition.test.ts` | PASS |
| Conditional write/concurrency | `commerce-service.ts`: `id + version + status + inventoryStatus` | concurrent cancellation integration test | PASS |
| Release inventory once | `releaseOrderInventory` | cancellation, retry/concurrency, missing allocation tests | PASS |
| Release capacity once | `releaseOrderAppointmentCapacity` | cancellation and concurrent cancellation tests | PASS |
| Paid/active online payment guard | policy and locked payment/session check | paid-order and active-VNPAY-session integration tests | PASS |
| Transaction and audit rollback | audit is in the same transaction | audit foreign-key failure rollback test | PASS |
| Customer API/UI and IDOR | cancel route, server action list, confirmation UI | E2E cancellation and direct IDOR tests | PASS |
| Admin endpoint protection | explicit operations-role guard | E2E direct customer request returns `403` | PASS |
| Bounded expiry | `expireUnpaidOrders`, `scripts/expire-unpaid-orders.ts` | PostgreSQL maintenance expiry/retry test | PASS |

## Phase 3 Files

- `src/modules/commerce/domain/order-transition.ts`
- `src/modules/commerce/application/commerce-service.ts`
- `src/modules/commerce/infrastructure/order-repository.ts`
- `src/modules/commerce/presentation/schemas.ts`
- `app/api/v1/orders/[id]/actions/cancel/route.ts`
- `app/api/v1/admin/orders/[id]/actions/route.ts`
- `app/(customer)/orders/[id]/page.tsx`
- `src/components/commerce/order-cancellation.tsx`
- `scripts/expire-unpaid-orders.ts`
- `tests/unit/order-transition.test.ts`
- `tests/integration/order-transitions.test.ts`
- `tests/fixtures/customer-orders.ts`
- `tests/e2e/customer-orders.spec.ts`
- `docs/ORDER_STATE_MACHINE.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_RUNBOOK.md`, `README.md`, `package.json`

No Prisma schema or migration was required. The existing schema already has order versioning, allocation lifecycle, cancellation fields, appointment capacity-release fields, payment lifecycle, and audit storage.

An independent Phase 2 crypto regression surfaced during `pnpm test`: non-canonical base64url text could decode to the same bytes. `src/modules/identity/infrastructure/password-reset-outbox-crypto.ts` now re-encodes before AES-GCM decryption to reject alternate spellings. Its targeted and full unit tests pass.

`commerce-service.ts` contains a pre-existing unrelated customer status-filter change in this dirty worktree; Phase 3 did not modify or revert that behavior.

## Verification

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | PASS - 17 migrations, no pending migration |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS - 38 files, 189 tests |
| `pnpm test:integration` | PASS - 12 PostgreSQL-backed files, 100 tests |
| `pnpm test:migration` | PASS - valid history and invalid-history/rollback checks |
| `pnpm test:e2e` | PASS - 50 tests, run after final `db:migrate` on fresh source |
| `pnpm build` | PASS |
| Touched-file Prettier check | PASS |

`pnpm format:check` is **FAIL** for 75 pre-existing formatting violations outside Phase 3, including legacy customer layouts, warranty files, and existing E2E files. No Phase 3 file is listed. This global formatting baseline is a Phase 7 remediation item and was not bulk-edited in a dirty worktree.

## Residual Risks

1. No automatic scheduler exists. Operations must approve cadence and runbook execution before scheduling expiry.
2. Customer cancellation notification is not implemented; Support/Operations must handle notification manually.
3. Full VNPay session exclusivity and reconciliation remain Phase 4 work. Phase 3 only blocks cancellation while a local payable session is active.
4. Production distributed rate limiting, object storage, and staging evidence remain later phases.
5. The global format baseline needs a separately reviewed cleanup before `pnpm format:check` can be a release gate.

## Conclusion

Phase 3 is complete at repository level. An unpaid cancellation/explicit expiry cannot leave a successfully committed order with permanently reserved stock or capacity; final PostgreSQL integration and E2E suites passed after the final migration check.
