# Customer Layout Fix Report

Date: 2026-07-16

## Final Status

**CUSTOMER LAYOUT ARCHITECTURE FIXED**

## 1. Root Cause

`CustomerLayout` was a page-local wrapper rendered only by the homepage and
account page. The remaining catalog and commerce routes were sibling pages under
`app/layout.tsx`, which only renders the HTML document and `{children}`.

Because there was no shared customer nested layout, client navigation to
products, cart, checkout, or orders replaced the page-local header, navbar, and
footer.

## 2. Architecture Before

```text
app/layout.tsx
|
+-- page.tsx                    -> CustomerLayout
+-- account/page.tsx            -> CustomerLayout
+-- products/*                  -> page content only
+-- cart/page.tsx               -> page content only
+-- checkout/page.tsx           -> page content only
+-- orders/*                    -> page content only
+-- order-confirmation/*        -> page content only
+-- admin/layout.tsx            -> AdminLayout
+-- technician/layout.tsx       -> TechnicianLayout
```

## 3. Architecture After

```text
app/layout.tsx
|
+-- (customer)/layout.tsx       -> CustomerLayout
|   +-- page.tsx                /
|   +-- products/*              /products, /products/[slug]
|   +-- cart/page.tsx           /cart
|   +-- checkout/page.tsx       /checkout
|   +-- orders/*                /orders, /orders/[id]
|   +-- order-confirmation/*    /order-confirmation/[id]
|   +-- account/page.tsx        /account
|
+-- admin/layout.tsx            -> AdminLayout, unchanged
+-- technician/layout.tsx       -> TechnicianLayout, unchanged
+-- auth pages                  -> AuthLayout, outside customer group
+-- api/*                       unchanged
```

The route group is pathless, so all public URLs remain unchanged. The shared
layout resolves the optional server actor only to select role-aware customer
navigation. It is not used as an authorization boundary.

## 4. Files Changed

Added:

- `app/(customer)/layout.tsx`
- `tests/e2e/customer-layout-persistence.spec.ts`
- `docs/CUSTOMER_LAYOUT_FIX_REPORT.md`

Moved without changing public paths:

- `app/page.tsx` -> `app/(customer)/page.tsx`
- `app/products/` -> `app/(customer)/products/`
- `app/cart/` -> `app/(customer)/cart/`
- `app/checkout/` -> `app/(customer)/checkout/`
- `app/orders/` -> `app/(customer)/orders/`
- `app/order-confirmation/` -> `app/(customer)/order-confirmation/`
- `app/account/` -> `app/(customer)/account/`

Composition-only edits:

- Removed the page-local `CustomerLayout` wrapper and actor lookup from the
  homepage.
- Removed the duplicate page-local `CustomerLayout` wrapper from account.
- Updated the homepage static image import for its new filesystem location.

No Header, Navbar, Footer, or CustomerLayout component was recreated or rewritten.

## 5. Security Preservation

The following page-level controls remain in place after the move:

- `requirePageActor` on account, cart, checkout, orders, order detail, and order
  confirmation.
- Existing `getOrder` ownership checks for order detail and confirmation.
- Existing cart, address, catalog, and commerce service calls.
- Existing Admin and Technician role layouts and server guards.

No backend, API, Prisma schema, database, authentication logic, authorization
logic, middleware, or business rule changed.

## 6. Test Results

Executed on the current repository and a freshly rebuilt production-like Docker
container:

- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS, 70/70
- `pnpm test:integration`: PASS, 53/53 on PostgreSQL
- `pnpm build`: PASS
- `pnpm demo:up`: PASS
- `pnpm test:e2e`: PASS, 24/24

The new E2E coverage proves:

- The CustomerLayout DOM persists during client navigation from `/` to
  `/products`.
- `/products/[slug]` retains the customer shell.
- `/account`, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, and
  `/order-confirmation/[id]` each render one customer logo/header, navbar, and
  footer.
- No duplicate customer shell is rendered.
- Auth pages remain outside the customer route layout.
- Existing Admin and Technician E2E flows remain green.

The generated Next.js route manifest still exposes the same public URLs.

## 7. Risk Assessment

Residual risk: **LOW**.

- Route ownership changed, but public paths and server guards are covered by
  build-time route validation and E2E tests.
- A developer with an already-running Next.js dev server may retain stale
  `.next/dev/types` references to pre-move paths. Restarting the dev server clears
  this generated cache; no source or TypeScript relaxation is required.
- The route-group layout performs one optional server actor lookup for the shared
  role-aware header. Protected pages still perform their own authoritative actor
  and ownership checks.

## Rollback

Move the customer route files back to their original `app/` locations, restore
the two page-local CustomerLayout wrappers, and remove
`app/(customer)/layout.tsx` plus the persistence test. No database or API rollback
is required.
