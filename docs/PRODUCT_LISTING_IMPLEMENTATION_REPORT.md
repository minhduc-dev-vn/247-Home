# Product Listing Implementation Report

## 1. Current State

The `/products` route is now a customer-facing ecommerce catalog inside the shared `CustomerLayout`. It replaces the previous technical form-and-list presentation while preserving the existing catalog service, API contract, database, authentication, authorization, and business rules.

**Final status: PRODUCT LISTING READY**

## 2. Architecture

```text
app/(customer)/layout.tsx
  CustomerLayout
    Header + customer navigation
    app/(customer)/products/page.tsx
      Breadcrumb
      Catalog introduction
      Category navigation
      ProductFilters
      ProductCard grid
      Cursor pagination
      ServiceAreaChecker
    Footer
```

The route remains a dynamic server component. Query validation continues to use `productListQuerySchema`, and catalog reads continue to use `listPublicProducts` and `getPublicProduct`.

## 3. Components Created or Updated

- `category-presentation.tsx`: one UI mapping for the four real catalog categories and category-specific icons.
- `product-filters.tsx`: desktop sidebar and mobile modal drawer using the supported category, text, and price query parameters.
- `product-card.tsx`: reusable card with real image support, category-aware fallback, safe VND formatting, stock state, installation-package visibility, after-sales support, and detail CTA.
- `products/loading.tsx`: route-level loading skeleton.
- `service-area-checker.tsx`: design-system form and feedback states while retaining the existing endpoint and payload.

## 4. Data Source

- Product list: `listPublicProducts`.
- Product details and active installation packages: `getPublicProduct` for the bounded current page.
- Product images: existing `/api/v1/product-images/[id]` endpoint.
- Service area result: existing `/api/v1/service-areas/check` endpoint.
- Prices remain decimal strings and are formatted without converting to unsafe JavaScript numbers.

No mock API, hardcoded product list, fake brand, fake installation rule, or schema change was introduced.

## 5. UX Decisions

- Category navigation only contains categories present in the Prisma enum and catalog contract.
- Mobile category navigation scrolls horizontally without increasing document width.
- Desktop uses a persistent filter sidebar; mobile and tablet use a native modal drawer with browser-managed focus and Escape handling.
- The page reports an exact count when the current cursor page is the last page. When another cursor exists, it explicitly labels the value as the count for the current page.
- Product records without an image use a category-specific icon placeholder, avoiding unrelated product photography.
- Installation messaging is derived only from active service packages returned by the existing detail service.
- Empty, invalid-filter, loading, in-stock, out-of-stock, supported-area, unsupported-area, and request-error states are represented.

## 6. Test Results

Commands run on the final implementation:

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 70/70 |
| `pnpm test:integration` | PASS, 53/53 |
| `pnpm test:e2e` | PASS, 27/27 |
| `pnpm build` | PASS |

`tests/e2e/product-listing.spec.ts` verifies real API-backed cards, customer shell visibility, detail CTA navigation, real category filtering, empty results, the mobile filter drawer, and no horizontal overflow at 390, 768, and 1440 pixels.

Visual review was also performed at all three target widths after waiting for real product cards rather than the streaming loading state.

## 7. Known Limitations

- The public catalog contract has no brand field, so the UI does not invent or infer a brand from product names.
- The contract has no product-specific warranty term. Cards therefore state that warranty requests are supported, not that a particular official warranty duration exists.
- The contract has no sort parameter, installation-only filter, or exact total-count field. Those controls are intentionally absent rather than simulated on one page of cursor results.
- Installation availability requires one existing detail-service read per product on the bounded current page. A future reviewed API extension could include this summary in the list projection and remove those extra reads.
- Playwright reports the existing Next.js advisory about declaring `data-scroll-behavior="smooth"` on the root element. It does not fail tests or affect the verified layouts.

## Database and Rollback

- Database action: none.
- Migration: none.
- Dependencies: none added.
- Rollback: restore the previous product page and card/filter presentation files; no data rollback is needed.
