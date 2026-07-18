# Cart Audit

## Current State

- `/cart` is an authenticated customer route inside the shared `CustomerLayout`.
- The previous page rendered a read-only list and a checkout link.
- Quantity update and removal APIs existed but had no customer UI.
- Empty state, mutation errors, installation summary, responsive summary layout, and route loading state were missing.

## Available APIs

- `GET /api/v1/cart`: returns the active customer cart.
- `POST /api/v1/cart/items`: adds a product variant and optional compatible service package.
- `PATCH /api/v1/cart/items/[id]`: replaces quantity within the server limit of 1 to 99.
- `DELETE /api/v1/cart/items/[id]`: removes an owned cart item.
- Every mutation returns the complete updated cart DTO, allowing the UI to wait for server confirmation before updating.

## Available Cart Data

- Cart ID, status, and version.
- Cart item ID, product variant ID, combined product/variant display name, and quantity.
- Optional service package ID and name.
- Device and service unit prices as decimal strings.
- Current availability derived by the server.

## Missing Capabilities

- Product image ID or slug.
- Separate product name and variant name in the public cart DTO.
- SKU in the public cart DTO.
- A cart-level pricing summary before an address is selected.
- Shipping, service-area fee, and installation slot are intentionally resolved during checkout.

The UI must not query the database directly, infer SKU/name boundaries, or fabricate product media. It uses a neutral product placeholder and labels the existing variant ID accurately.

## UI Mapping Plan

- Render each server cart line as a reusable `CartItem`.
- Apply quantity and removal mutations without optimistic state changes.
- Recalculate the displayed device, package, and estimated totals only from decimal-string prices returned by the latest server response.
- Clearly state that checkout performs the authoritative pricing, inventory, shipping, and installation-area validation.
- Preserve the existing guest redirect and customer-role enforcement.
