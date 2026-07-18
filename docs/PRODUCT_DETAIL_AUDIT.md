# Product Detail Audit

## Available Data

The existing `getPublicProduct` service returns:

- Product ID, slug, name, description, and category.
- All active product images with authorized public image IDs and alt text.
- Active variants with ID, SKU, name, decimal-string VND price, and computed availability.
- Active installation packages for each variant with ID, name, description, and decimal-string VND price.

The existing service-area endpoint accepts province and district codes on explicit form submission. The existing cart endpoint accepts only product variant ID, optional compatible service package ID, and quantity; authentication and compatibility validation remain server-side.

## Missing Fields

- Brand and manufacturer.
- Structured technical specifications such as dimensions, capacity, power, or connectivity standards.
- Product-specific warranty duration and policy terms.
- Explicit related-product ranking.
- Product rating and review data.

These values must not be inferred from names or descriptions.

## Previous UI

The previous route rendered product text, a flat list of variants/packages, and a technical add-to-cart form. It had no gallery, purchase hierarchy, installation experience, service-area section, after-sales context, related-product navigation, route loading state, or responsive ecommerce composition.

## UI Mapping Strategy

- Use real images when present; otherwise use the category-specific catalog fallback.
- Treat same-category products returned by the existing list service as discoverable alternatives, without claiming personalized recommendation.
- Present only SKU, variant, category, availability, and prices as technical/catalog facts.
- State after-sales platform capabilities without claiming warranty duration.
- Derive installation availability only from active service packages returned for the selected product.
- Submit cart intent to the existing endpoint without sending any price or total from the client.
