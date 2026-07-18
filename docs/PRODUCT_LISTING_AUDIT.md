# Product Listing Audit

## Current State

- `/products` uses Next.js App Router and is already inside the shared `CustomerLayout` route group.
- Product data comes directly from `listPublicProducts`; product detail and installation packages come from `getPublicProduct`.
- The previous page rendered a raw GET form and a basic article grid. It did not use the design-system navigation, cards, empty state, or pagination components.
- The previous page duplicated its own category labels and used ASCII-only Vietnamese copy.
- Loading and invalid-filter states were not represented in the route UI.

## Catalog Contract

The public list contract supports:

- Category: `SECURITY_CAMERA`, `VIDEO_DOORBELL`, `MESH_WIFI`, `SMART_LOCK`.
- Text search over product name and description.
- Minimum and maximum VND price.
- Cursor pagination with a maximum page size of 24.
- Product name, description, category, minimum price, availability, first image, and active variants.

The list contract does not expose brand, product warranty terms, sorting, an exact total count, or installation-package availability. These capabilities must not be simulated in the client. Installation availability can be derived from the existing bounded product-detail service for the products on the current page.

## Problems

1. The page looked like an internal prototype rather than a customer catalog.
2. Filters did not have reusable labels, focus treatment, responsive composition, or clear reset behavior.
3. Product cards did not provide category-aware media fallback or installation and after-sales signals.
4. Cursor pagination was rendered as an isolated “load more” link rather than shared navigation.
5. There was no dedicated loading skeleton or useful empty state.
6. The previous generic fallback image could imply a product image that does not exist in catalog data.

## Recommended Structure

```text
CustomerLayout
  Header / customer navigation
  Product page
    Breadcrumb + catalog introduction
    Real category navigation
    Responsive filters
    Current result context
    ProductCard grid
    Cursor pagination
    Service-area checker
  Footer
```

The UI should expose only real category/search/price filters. Brand, sort, exact totals, and installation-only filtering require a future API-contract change and are outside this frontend-only task.
