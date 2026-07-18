# Customer Order Data Audit

## 1. Scope

Audit này đối chiếu customer routes `/orders`, `/orders/[id]`, commerce query
service, Operations state machine, API routes và Prisma schema. Task không cho
phép thay đổi backend business logic, schema, order service, authentication,
authorization hoặc API contract.

## 2. Current architecture

```text
app/(customer)/layout.tsx
  -> CustomerLayout (shared header, navigation, footer)
  -> /orders and /orders/[id] Server Components
  -> commerce listOrders/getOrder
  -> Prisma query with customer ownership scope
  -> PostgreSQL
```

- Next.js App Router và shared customer route group đang hoạt động.
- Read pages là Server Components, phù hợp ADR-004 trong `ARCHITECTURE.md`.
- Browser không truy cập Prisma và không quyết định ownership.
- Money đi qua decimal string DTO và `formatVnd`; không chuyển sang JavaScript
  `Number`.

## 3. Existing data

| Domain | Database has | Customer order DTO exposes |
|---|---|---|
| Order | number, status, totals, address snapshot, timestamps, version | id, number, status, grand total, currency, version |
| Order item | product/variant/SKU/package and price snapshots | product name, variant name, quantity, line total |
| Payment | method, status, amount, reference, timestamps | method, status, amount, reference code |
| Appointment | status, schedule, service area, note, version | id, status, scheduled start/end |
| Technician assignment | technician, lifecycle timestamps, completion note | not exposed |
| Evidence | authorized storage metadata and preview | not exposed to customer order DTO |
| Audit | actor/action/resource/timestamp | not exposed to customer order DTO |

The implementation only renders the right-hand column. It does not use a direct
Prisma query from React and does not derive private Operations records outside
the customer contract.

## 4. Existing endpoints

### `GET /api/v1/orders`

- Authenticated customer list.
- Cursor pagination with bounded `limit` (`1..100`, default `25`).
- Ownership is enforced by `where: { userId: actor.userId }`.
- Response uses `Cache-Control: private, no-store`.

### `GET /api/v1/orders/{id}`

- Returns the whitelisted order DTO.
- A non-admin query is scoped by both order id and actor user id.
- An out-of-scope order returns `404`, preventing resource enumeration.
- Response uses `Cache-Control: private, no-store`.

### Operations endpoints

Operations detail, assignment and evidence endpoints are role/assignment scoped.
They are not valid customer data sources. Reusing them in customer UI would
weaken authorization and was intentionally rejected.

## 5. State sources

- Order states come from `OrderStatus` and `docs/ORDER_STATE_MACHINE.md`.
- Installation states come from `AppointmentStatus`,
  `docs/INSTALLATION_STATE_MACHINE.md` and
  `src/modules/operations/domain/installation-transition.ts`.
- The application state machine does not create legacy `CONFIRMED` appointments,
  but the customer mapping remains read-compatible with historical rows.
- No UI-only order, payment or appointment status was added.

## 6. UI gaps before implementation

- `/orders` was a plain link list without status labels, payment/install context,
  empty state, filtering, bounded page size or pagination control.
- `/orders/[id]` displayed raw enum values and a flat item list.
- There was no order lifecycle, installation timeline, support context, loading
  state, route error state or mobile-specific verification.
- Ownership existed in the server query, but there was no dedicated customer
  orders E2E proving API and page denial.

## 7. Contract gaps retained by design

The current customer DTO does not expose:

- order `createdAt`, so the UI must not invent an order date;
- address snapshot fields, so the UI does not render private address values;
- product image, SKU, service package name or individual unit-price fields;
- assigned technician identity, evidence, completion note or Operations audit;
- actual transition timestamps needed for a timestamped historical timeline.

The UI therefore presents a state-machine progress view from current states,
not a fabricated event history. Technician information uses the approved
fallback copy. A future task may add a reviewed, customer-safe projection, but
that is outside this task's explicit contract freeze.

## Audit result

The existing contract is sufficient for customer order history, order snapshot,
payment state and installation state/schedule. It is not sufficient for order
date, full address, named technician, evidence or timestamped event history.
