# Customer Storefront Progress

Updated: 2026-07-16

## Hero Layout Remediation

The customer hero now renders as one responsive composition. Desktop uses a
640-pixel side-by-side layout; mobile and tablet place the content before the
image within the same section. The fix avoids `next/image` fill-mode inline
positioning, which conflicted with the production CSP, and retains the existing
asset, copy, CTA, design tokens, and customer navigation.

Evidence and root-cause details are recorded in `HERO_LAYOUT_AUDIT.md` and
`HERO_SECTION_FIX_REPORT.md`.

## Current Status

The customer homepage is implemented as a production-style ecommerce and
installation-service storefront. It uses the existing design system,
`CustomerLayout`, catalog application services, public product-image endpoint,
and server-resolved authentication context.

## Completed

| Area | Status | Implementation |
| --- | --- | --- |
| Storefront header | Complete | Product, installation, warranty, order, login/account, and cart destinations |
| Hero | Complete | Primary offer, supporting copy, catalog CTA, responsive bitmap asset |
| Category discovery | Complete | Air conditioner, washing machine, refrigerator, TV, and Smart Home cards |
| Featured products | Complete | Four active products from `listPublicProducts`; no mock product data |
| Product merchandising | Complete | Image/fallback, name, price, stock, installation-package availability, detail CTA |
| Installation explanation | Complete | Four-step purchase-to-warranty flow |
| Trust content | Complete | Authenticity, technician, progress, and after-sales signals |
| Footer | Complete | Contact, support, policy, and order destinations |
| Responsive behavior | Complete | Automated checks at 390, 768, and 1440 pixels |
| Accessibility baseline | Complete | Semantic landmarks, ordered process, heading hierarchy, alt text, focusable links |

## Data Integration

- Featured products are loaded server-side with `listPublicProducts` and the
  existing validated query schema.
- Installation availability is derived from active service packages returned by
  `getPublicProduct` for the four featured products.
- Product prices remain decimal strings and are rendered by the existing safe VND
  formatter.
- Product images use `/api/v1/product-images/[id]` when present.
- The current demo seed contains no product images. Cards therefore show the
  bundled smart-home image with a visible `Ảnh minh họa` label instead of claiming
  it is the actual product image.

## Catalog Alignment

The current database enum contains four Smart Home categories:
`SECURITY_CAMERA`, `VIDEO_DOORBELL`, `MESH_WIFI`, and `SMART_LOCK`. The five
broader category cards requested for the homepage are merchandising labels only;
they do not invent filters or map to unsupported database enum values.

## Next Storefront Work

- Apply the design system to the existing product list and product detail pages.
- Add real catalog imagery through the existing secured admin image workflow.
- Add approved policy and customer warranty destinations when those routes exist.
- Validate the final copy and broader category taxonomy with the product owner.
