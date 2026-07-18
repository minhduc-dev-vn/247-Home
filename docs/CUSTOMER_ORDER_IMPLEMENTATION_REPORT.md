# Customer Order Management Implementation Report

## 1. Architecture

The customer order experience remains inside the existing App Router customer
route group:

```text
CustomerLayout
  -> /orders (Server Component, cursor query)
  -> /orders/[id] (Server Component, owned detail query)
  -> shared customer order presentation components
  -> existing commerce query service
```

No backend, API, database, Prisma schema, authentication, authorization,
Operations workflow or business rule was changed.

## 2. Data mapping

- Order list cards render order number, item snapshot summary, grand total,
  payment state, order state and installation state.
- Detail renders item names/variants/quantity/line total from order snapshots;
  it never reads current catalog prices.
- Payment renders existing method, status, amount and reference code.
- Installation renders the existing appointment state and scheduled start/end in
  `Asia/Ho_Chi_Minh`.
- Technician uses the required fallback because the customer DTO does not expose
  an authorized technician projection.
- Address values and order date are not fabricated when absent from the contract.

## 3. Status mapping

`src/components/commerce/order-status.tsx` is the single customer presentation
map for all Prisma `OrderStatus`, `PaymentStatus`, `PaymentMethod` and
`AppointmentStatus` values.

- The order timeline follows `PENDING_CONFIRMATION -> CONFIRMED -> PROCESSING ->
  READY_FOR_INSTALLATION -> INSTALLATION_IN_PROGRESS -> COMPLETED`.
- Cancellation is presented as a terminal exception without claiming unobserved
  intermediate events.
- Installation follows `SCHEDULED -> ASSIGNMENT_PENDING -> ASSIGNED -> EN_ROUTE
  -> ARRIVED -> IN_PROGRESS -> COMPLETED`.
- Legacy appointment `CONFIRMED`, `RESCHEDULE_REQUIRED` and `CANCELLED` remain
  safely representable without adding states.

## 4. Security

- Pages still call `requirePageActor` and the existing commerce query service.
- List queries remain scoped by customer `userId`.
- Detail queries retain `id + userId` ownership scope for non-admin actors.
- E2E verifies a different customer receives `404` from the direct API request
  and the page, with no order number or product data in the response/UI.
- No Operations endpoint was exposed to customers and no physical evidence path
  is present in this UI.

## 5. UX decisions

- Shared customer header/footer remains visible through `CustomerLayout`.
- History uses six-row cursor pages and the existing pagination component.
- Because the frozen list contract has no status query, status filtering is
  explicitly labelled as applying to the current page. The UI does not pretend
  to provide server-wide filtering.
- Loading, route error and empty states are included.
- Timelines are vertical, keyboard-readable ordered lists and use text plus icon
  state; color is not the only status signal.
- Product images are not mocked. A neutral package icon is used where the order
  DTO has no image snapshot.
- Support links only target existing destinations. No fake invoice download or
  customer mutation was added.

## 6. Tests

Added:

- `tests/unit/order-presentation.test.ts`: exhaustive backend enum mapping.
- `tests/fixtures/customer-orders.ts`: isolated customer/order/appointment
  namespace with idempotent targeted cleanup.
- `tests/e2e/customer-orders.spec.ts`: history, header/footer, own-order scope,
  cursor pagination, filter synchronization, detail snapshot, order timeline,
  installation timeline, payment, mobile overflow and cross-customer denial.

Focused verification during implementation:

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test -- --run tests/unit/order-presentation.test.ts` | PASS, 2 tests |
| `pnpm exec playwright test tests/e2e/customer-orders.spec.ts` | PASS, 4 tests |

Final repository verification:

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 20 files / 72 tests |
| `pnpm test:integration` | PASS, 7 files / 53 tests on PostgreSQL |
| `pnpm test:e2e` | PASS, 39 tests including 4 customer-order tests |
| `pnpm build` | PASS, Next.js production build |
| fixture residue SQL check | PASS, `customer_order_fixture_residue=0` |

Playwright emitted the existing Next.js smooth-scroll advisory; no test failed
and no retry was added to hide a failure.

Production-like local verification:

- `docker compose --env-file .env.demo.example up --build -d app`: PASS.
- Application container health: `healthy`; `/api/ready`: HTTP 200.
- Desktop list/detail visual inspection: PASS; grid bounds remain inside the
  viewport.
- Mobile detail inspection at 390 x 844: PASS; no page-level horizontal
  overflow and the vertical timeline remains readable.
- Browser console errors during list/detail inspection: 0.

## 7. Limitations

- Order date, full address, SKU/package split, product image, technician identity,
  evidence and timestamped audit events are unavailable in the frozen customer
  API contract. See `docs/CUSTOMER_ORDER_AUDIT.md`.
- Status filtering is page-local. Server-wide filtering requires an additive,
  reviewed list-query contract change and was intentionally not made.
- The timeline communicates valid state-machine progression from the current
  state; it is not an event log because transition timestamps are not exposed.

## 8. Change and rollback

- Database action: none.
- Dependencies: none.
- Rollback: revert the two order pages, customer order presentation component,
  route loading/error files, fixture/tests and these documents. No data rollback
  or migration is required.

## Final status

**CUSTOMER ORDER MANAGEMENT READY** for the data currently authorized by the
existing customer order contract. The listed contract gaps remain deliberately
unfilled rather than mocked or accessed through a weaker boundary.
