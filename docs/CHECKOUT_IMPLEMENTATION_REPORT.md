# Checkout Implementation Report

Ngày xác minh: 2026-07-17

## 1. Architecture

- `/checkout` remains a dynamic Server Component route inside the shared `CustomerLayout`.
- The server page resolves the active actor, owned cart, owned addresses, and own identity profile before rendering.
- `CheckoutFlow` is the client presentation/orchestration layer. It calls only existing Route Handlers and never imports Prisma or trusts browser pricing.
- `/order-confirmation/[id]` remains server-rendered and calls the ownership-scoped `getOrder()` query. A different customer receives the existing 404 policy.
- No database, Prisma schema, API Route Handler, authentication, RBAC, payment policy, or checkout transaction code was changed.

## 2. Checkout Flow

1. Guest navigation to `/checkout` is redirected to `/login` by `requirePageActor()`.
2. An authenticated CUSTOMER with a non-empty active cart sees account identity, saved addresses, cart lines, installation packages, and payment methods.
3. A new address is validated in the browser for UX and submitted to `POST /api/v1/addresses`; the server validates and matches the service area again.
4. For installation carts, the UI requests active slots for the matched service area and lets the customer choose only a slot with remaining capacity.
5. `POST /api/v1/cart/quote` returns the authoritative subtotal, area installation fee, shipping fee, and grand total.
6. The confirm action sends only cart ID, address ID, slot ID, payment method, and an opaque idempotency key.
7. The server transaction creates the real order and marks the cart checked out, then the UI redirects to `/order-confirmation/[id]`.

The client reuses one idempotency key when retrying the same intent. Selecting a different address, slot, or payment method invalidates that key and creates a new checkout intent.

## 3. Validation Rules

- Customer profile: own name and email are read-only; checkout does not overwrite identity data.
- Address: recipient name, phone, line 1, ward, district/province names and codes are required; optional line 2/note and postal code have server length limits.
- Phone: 8-20 characters from the server-approved number/space/plus/hyphen character set.
- Service area: the address response controls the supported/unsupported UI state; installation checkout stays disabled for an unsupported address.
- Installation: a server-returned future slot with available capacity is required when any cart line has an installation package.
- Payment: only existing `COD` and `BANK_TRANSFER` enum values are offered.
- Price: the order button requires a successful server quote; browser-computed line values are presentation only.

## 4. Order Creation Flow

The existing `checkout()` application service remains the sole order creation path. It reloads cart ownership, address ownership, active variants, compatible packages, current prices, inventory, service area, and slot state. The browser cannot submit an effective price, total, user ID, inventory value, or service-area decision.

After success:

- The old cart is `CHECKED_OUT` and linked to the order.
- A later `GET /api/v1/cart` resolves a new empty active cart for the customer.
- Confirmation displays the persisted order number, item snapshots, payment details, total, optional appointment, current status, next steps, and links to order detail/products.

## 5. Transaction Safety

The unchanged PostgreSQL transaction performs:

1. User-scoped idempotency claim and fingerprint check.
2. Active cart row lock and ownership check.
3. Server-side quote rebuild.
4. Stable-order inventory row locks and reservation.
5. Installation slot row lock and capacity increment when required.
6. Order, item snapshots, payment, optional appointment, and inventory allocation inserts.
7. Cart checkout and idempotency attempt linkage.

Any inventory, area, slot, persistence, or validation failure rolls back all transaction changes. Existing PostgreSQL integration tests cover final-SKU concurrency, final-slot concurrency, replay, price tampering rejection, unsupported areas, past/full slots, ownership, and rollback.

## 6. Security

- Server authentication and CUSTOMER role policy remain mandatory for cart, address, quote, and order operations.
- Address/cart/order ownership is constrained in server queries; the UI is not an authorization boundary.
- Mutations retain origin allowlisting, JSON content-type checks, body limits, rate limiting, strict Zod schemas, and no-store responses.
- Checkout requests contain no trusted money or customer ID fields.
- Cross-customer API and confirmation-page access returns 404 and reveals no order content.
- Double-submit is guarded in the UI and by the existing database-backed idempotency contract.

## 7. Test Results

Final gates run against the current source and PostgreSQL local database:

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS, 0 warnings |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 19 files / 70 tests |
| `pnpm test:integration` | PASS, 7 files / 53 tests |
| `pnpm test:e2e` | PASS, 35/35 |
| `pnpm build` | PASS, Next.js production build |

Checkout E2E proves:

- Guest login redirect.
- Real cart/product/package summary and 390/1440 responsive layout.
- Required address validation and unsupported-area blocking.
- Real slot selection, server quote, order creation, cart rollover, and confirmation page.
- Different-customer API and page denial.
- Authoritative out-of-stock conflict with no order created.
- Namespaced test customers, carts, addresses, slots, orders, allocations, and reservations are cleaned after each test.

Database residue check returned no `checkout-e2e-*` users after the full run.

## 8. Known Limitations

- `listAddresses()` does not expose phone or address line 2, so existing-address cards show only the current public address DTO. New address input still validates and persists phone server-side.
- The checkout contract does not accept `InstallationAppointment.customerNote`; the optional note is stored as address line 2 and copied into the order address snapshot instead.
- Service-area selection uses the existing province/district code contract; no external administrative-division provider or fake location dataset was added.
- The order detail DTO does not expose the full address snapshot or service-package name. Confirmation shows the available persisted products, payment, total, and appointment data without inventing fields.
- `docs/API_CONTRACT.md` names the quote route `/api/v1/checkout/quote`, while the implemented application route remains `/api/v1/cart/quote`. This task preserved the existing runtime contract.
- Next.js test output still contains the existing smooth-scroll advisory and an occasional stale local JWT decryption warning; all authorization assertions and gates pass.

## Rollback

Revert the checkout page, `CheckoutFlow`, confirmation page, E2E specification, and these two checkout documents. No database rollback, data migration, dependency rollback, or API rollback is required.

## Final Status

**CHECKOUT READY**
