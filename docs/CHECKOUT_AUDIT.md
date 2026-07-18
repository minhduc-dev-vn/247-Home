# Checkout Audit

## Current State

- `/checkout` is an authenticated CUSTOMER route inside the shared `CustomerLayout`.
- The existing page already loads the active cart and the first page of owned addresses on the server.
- The existing `CheckoutFlow` can create an address, load installation slots, request a quote, choose COD/manual bank transfer, create an order, and redirect to confirmation.
- The UI is still a functional prototype: untranslated labels, weak hierarchy, no customer profile context, limited loading/error states, and no complete confirmation summary.

## Available APIs

| Capability | Implemented endpoint | Trust boundary |
| --- | --- | --- |
| Active cart | `GET /api/v1/cart` / `getCart()` | CUSTOMER ownership enforced server-side |
| Owned addresses | `GET/POST /api/v1/addresses` | Actor supplies no trusted user ID |
| Quote | `POST /api/v1/cart/quote` | Server reloads catalog/package/area prices |
| Installation slots | `GET /api/v1/installation-slots` | Server filters active, future slots and returns remaining capacity |
| Create order | `POST /api/v1/orders` | Requires user-scoped `Idempotency-Key` |
| Order detail | `GET /api/v1/orders/[id]` / `getOrder()` | CUSTOMER ownership is included in the query |

`docs/API_CONTRACT.md` still names the quote endpoint `/api/v1/checkout/quote`; the implemented route used by the application is `/api/v1/cart/quote`. This task does not change that API contract.

## Order Creation Flow

`checkout()` owns one PostgreSQL transaction:

1. Claim a user-scoped idempotency attempt and verify the request fingerprint.
2. Lock the active cart and verify ownership.
3. Reload active variants, compatible service packages, address, service area, and all prices.
4. Lock inventory rows in stable variant ID order and reserve available stock.
5. Lock and reserve the requested future installation slot when installation is required.
6. Create order snapshots, order items, payment, optional appointment, and inventory allocations.
7. Mark the cart `CHECKED_OUT` and link the idempotency attempt to the order.
8. Commit all changes together; any error rolls the complete transaction back.

The browser does not submit price, total, customer ID, inventory state, service-area result, or slot capacity as trusted data.

## Existing Validation

- Strict Zod schemas validate address, quote, checkout body, payment method, slot query, and pagination.
- Mutation middleware validates allowed origin, JSON content type, body size, and rate limits.
- Installation requires an active matching service area and a future slot with remaining capacity.
- Cart ownership, address ownership, inventory, package compatibility, pricing, and slot state are rechecked during checkout.
- Replayed identical requests return the existing order; the same key with a different fingerprint is rejected.

## Missing UI

- Professional checkout header, breadcrumb, responsive form/sidebar layout, and clear progress context.
- Read-only account name/email context without overwriting the identity profile.
- Fully labelled address form, optional delivery note, validation feedback, and explicit supported/unsupported area state.
- Slot loading, empty, full-capacity, and retry states.
- Server-quote summary with clear fee breakdown and mutation loading state.
- A stable client idempotency key across retries of the same checkout intent.
- Confirmation content for products, payment, appointment, current status, next steps, and follow-up actions.

## UI Mapping Plan

- Keep the Server Component responsible for actor, profile, cart, and initial address reads.
- Keep all mutations behind existing Route Handlers.
- Use server quote values for subtotal/fees/grand total and cart DTO values only for line presentation.
- Regenerate the client idempotency key only when address, slot, or payment intent changes; reuse it after transport/server errors.
- Preserve server redirects and ownership checks as the authorization boundary.
