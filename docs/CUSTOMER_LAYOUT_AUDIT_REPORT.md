# Customer Layout Audit Report

Date: 2026-07-16

## Final Status

**CUSTOMER LAYOUT AUDIT COMPLETE**

This is an architecture audit only. No application component, route,
middleware, authentication, API, or business logic was changed.

## 1. Current Architecture

247 Home uses **Next.js App Router only**.

- Application routes live in `app/`.
- There is no `pages/` directory.
- There are no route groups such as `(customer)` or `(auth)`.
- There is no repository middleware file or middleware directory.
- The root layout only renders the HTML shell and `{children}`. It does not
  render a header, footer, or role-specific application shell.
- Admin and Technician have nested route layouts.
- Customer pages do not have a shared nested route layout.

Current route/layout hierarchy:

```text
app/
|
+-- layout.tsx                         RootLayout: html + body only
|
+-- page.tsx                           /, page-local CustomerLayout
+-- account/page.tsx                   /account, page-local CustomerLayout
|
+-- products/page.tsx                  /products, RootLayout only
+-- products/[slug]/page.tsx           /products/[slug], RootLayout only
+-- cart/page.tsx                      /cart, RootLayout only
+-- checkout/page.tsx                  /checkout, RootLayout only
+-- orders/page.tsx                    /orders, RootLayout only
+-- orders/[id]/page.tsx               /orders/[id], RootLayout only
+-- order-confirmation/[id]/page.tsx   confirmation, RootLayout only
|
+-- admin/
|   +-- layout.tsx                     AdminRouteLayout -> AdminLayout
|   +-- page.tsx
|   +-- catalog/page.tsx
|   +-- operations/page.tsx
|   +-- service-areas/page.tsx
|
+-- technician/
|   +-- layout.tsx                     TechnicianRouteLayout -> TechnicianLayout
|   +-- page.tsx
|
+-- login, register, password pages    page-local AuthLayout
+-- api/                               route handlers, not UI layouts
```

The requested `/products/[id]` route is implemented as `/products/[slug]` in
the current repository.

## 2. Route Map

| Route | Effective layout chain | Customer header | Customer footer |
| --- | --- | --- | --- |
| `/` | `RootLayout -> HomePage -> CustomerLayout` | YES | YES |
| `/products` | `RootLayout -> ProductsPage` | NO | NO |
| `/products/[slug]` | `RootLayout -> ProductDetailPage` | NO | NO |
| `/cart` | `RootLayout -> CartPage` | NO | NO |
| `/checkout` | `RootLayout -> CheckoutPage` | NO | NO |
| `/orders` | `RootLayout -> OrdersPage` | NO | NO |
| `/orders/[id]` | `RootLayout -> OrderPage` | NO | NO |
| `/order-confirmation/[id]` | `RootLayout -> ConfirmationPage` | NO | NO |
| `/account` | `RootLayout -> AccountPage -> CustomerLayout` | YES | YES |
| `/admin/*` | `RootLayout -> AdminRouteLayout -> AdminLayout` | NO, Admin header | NO |
| `/technician` | `RootLayout -> TechnicianRouteLayout -> TechnicianLayout` | NO, Technician header | NO |

`/account` is important: the current branch explicitly imports and renders
`CustomerLayout`, so the customer header should be present there. If a running
instance does not show it, that observation is inconsistent with the current
source and should be checked for a stale build/container or a different revision.
It is not explained by the missing customer nested layout affecting the other
routes.

## 3. Header Rendering Flow

There is no separate component named `CustomerHeader`. The customer shell is
assembled as follows:

```text
HomePage or AccountPage
  -> CustomerLayout
      -> Header
          -> Navbar
          -> getCustomerNavigation(roles)
      -> page children
      -> Footer
```

Locations:

| Responsibility | File | Rendered by |
| --- | --- | --- |
| Customer shell | `src/components/layout/customer-layout.tsx` | `app/page.tsx`, `app/account/page.tsx` only |
| Shared header frame | `src/components/layout/header.tsx` | Customer, Admin, and Technician layouts with different navigation |
| Customer navigation data | `src/components/layout/role-navigation.tsx` | `CustomerLayout` |
| Navbar links | `src/components/navigation/navbar.tsx` | `Header` |
| Customer footer | `src/components/layout/footer.tsx` | `CustomerLayout` |

`CustomerLayout` is currently a normal React component imported by individual
pages. It is not a Next.js route layout and therefore does not persist or apply
automatically when navigation changes to a sibling route.

## 4. Root Cause

**ROOT CAUSE: Customer navigation is implemented as a page-local wrapper, while
the customer route tree has no shared nested `layout.tsx`.**

More specifically:

1. `app/layout.tsx` renders only `<body>{children}</body>`.
2. `app/page.tsx` and `app/account/page.tsx` explicitly render
   `CustomerLayout`.
3. Products, cart, checkout, orders, details, and confirmation pages return
   their own `<main>` elements directly.
4. These routes are siblings under the root layout, so navigating between them
   replaces the entire page-local customer shell.

The audit found no evidence of:

- A nested layout override removing the customer header.
- A pathname condition hiding the header.
- Middleware redirecting to an alternate customer layout.
- Pages Router/App Router interaction.
- CSS hiding the header on these routes.

This is **Case B: the affected routes are not inside `CustomerLayout`**, caused
by the absence of a customer route group and nested layout. It is also partially
Case A in the sense that the wrapper is manually owned by selected page files,
but the header itself is correctly encapsulated in `CustomerLayout`, not coded
directly inside the homepage.

## 5. Recommended Architecture

Create a pathless App Router route group with one customer nested layout. Route
groups do not alter public URLs.

```text
app/
|
+-- layout.tsx                         HTML document only
|
+-- (customer)/
|   +-- layout.tsx                     resolves optional actor roles
|   |                                  -> CustomerLayout
|   +-- page.tsx                       /
|   +-- products/page.tsx              /products
|   +-- products/[slug]/page.tsx       /products/[slug]
|   +-- cart/page.tsx                  /cart
|   +-- checkout/page.tsx              /checkout
|   +-- orders/page.tsx                /orders
|   +-- orders/[id]/page.tsx           /orders/[id]
|   +-- order-confirmation/[id]/page.tsx
|   +-- account/page.tsx               /account
|
+-- admin/
|   +-- layout.tsx                     AdminLayout, unchanged
|
+-- technician/
|   +-- layout.tsx                     TechnicianLayout, unchanged
|
+-- login, register, reset routes      AuthLayout, outside customer group
+-- api/                               unchanged
```

The `(customer)/layout.tsx` should:

1. Resolve the optional current actor server-side for role-aware navigation.
2. Render exactly one `CustomerLayout` around `children`.
3. Leave required authentication and ownership guards in cart, checkout, order,
   and account pages unchanged.

The manual `CustomerLayout` wrappers in the homepage and account page must be
removed when they move under this route group, otherwise those routes will
render duplicate headers and footers.

Do not place `CustomerLayout` in the global root layout. That would nest the
customer header around Admin, Technician, and Auth experiences and conflict with
their dedicated shells.

## 6. Expected File Changes

The recommended remediation would require a separate implementation task:

- Add `app/(customer)/layout.tsx`.
- Move the homepage and listed customer route files/directories into
  `app/(customer)/` without changing their public URLs.
- Remove page-local `CustomerLayout` imports/wrappers from the moved homepage and
  account page.
- Keep `requirePageActor`, ownership checks, catalog calls, and commerce calls in
  their existing pages.
- Add or update E2E assertions proving the same customer header/footer persists
  on products, product detail, cart, checkout, orders, order detail, account, and
  confirmation routes.
- Keep `app/admin/layout.tsx`, `app/technician/layout.tsx`, API routes, and auth
  pages outside the customer group.

No change to `Header`, `Navbar`, `Footer`, or `CustomerLayout` is inherently
required to fix layout ownership.

## 7. Risk Assessment

Overall implementation risk: **MEDIUM**.

The design is conventional and does not change URLs, but moving App Router files
can introduce route collisions or duplicate layouts if done incompletely.

| Area | Impact | Notes |
| --- | --- | --- |
| Backend | NO | Domain and application services remain unchanged |
| API | NO | Route handlers stay under `app/api` |
| Database | NO | No schema, migration, or data action |
| Authentication logic | NO | Existing page guards remain authoritative |
| Authorization | NO | Ownership and role checks remain server-side |
| Middleware | NO | No middleware currently exists or is needed for layout composition |
| Public URLs | NO | Route groups are omitted from URL paths |
| Frontend tests | YES | Header persistence and duplicate-shell regressions need E2E coverage |

Primary remediation risks:

- Accidentally leaving both old and grouped routes, causing duplicate route
  definitions.
- Leaving page-local wrappers in `/` or `/account`, causing duplicate headers.
- Moving auth/admin/technician pages into the customer group by mistake.
- Resolving roles only on the client, causing hydration or navigation flicker.
- Removing existing page-level security guards under the false assumption that a
  layout is an authorization boundary.

## Audit Conclusion

The disappearing navbar is an ownership problem in the App Router tree, not a
Navbar component defect. A single `(customer)/layout.tsx` is the correct boundary
for the storefront and authenticated customer flow, while Admin and Technician
must retain their existing dedicated nested layouts.
