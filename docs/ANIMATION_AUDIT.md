# Animation Audit

Date: 2026-07-20
Scope: customer, admin and technician frontend surfaces

## Current state before implementation

247 Home used Next.js App Router, React Server Components, Tailwind CSS v4 and
the shared design tokens in `app/globals.css`. No animation library was
installed. Motion was limited to loading spinners, pulse skeletons, a product
image hover scale and a few color transitions. The global stylesheet already
disabled non-essential animation for `prefers-reduced-motion`.

| Surface | Existing behavior | Missing behavior |
| --- | --- | --- |
| Home | Product image hover | Hero sequence, section reveal, service progression |
| Product list/detail | Skeletons and image hover | Staggered results, gallery/price feedback, filter drawer motion |
| Cart/checkout | Loading buttons | Quantity and pending-item feedback |
| Orders/warranty | Static timelines | State/node/feedback transitions |
| Admin Operations | Row hover colors, loading states | Consistent table, tab, modal and confirmation motion |
| Technician | Evidence image hover, spinners | Touch feedback, job entry, dialog and status progression motion |
| Navigation | Color hover | Active indicator and consistent interaction timing |

## Route and component findings

- Customer routes live in `app/(customer)` and share `CustomerLayout`.
- Admin routes live in `app/admin` and retain server role guards in their
  layout and routes.
- Technician routes live in `app/technician` and retain the technician server
  guard.
- Interactive business workflows are already isolated in client components;
  motion can decorate those boundaries without moving authorization or state
  policy to the browser.
- Loading pages exist for product, product detail, cart, order and warranty
  routes, so the motion system should preserve their stable dimensions.

## Recommended system

1. Use shared duration/easing tokens: 160 ms, 240 ms and 380 ms.
2. Use route-segment templates for subtle page entry while keeping headers and
   role layouts stable.
3. Use one IntersectionObserver reveal primitive for below-fold content.
4. Animate only compositor-friendly `opacity` and `transform` for entry and
   state feedback; transition color, border and shadow only on small controls.
5. Keep loading spinners/skeletons functional and fully suppress decorative
   motion under reduced-motion preference.
6. Keep server data, authorization and transition policy unchanged.

## Performance risks and controls

| Risk | Control |
| --- | --- |
| Large client motion bundle | No Framer Motion dependency; one small observer component |
| Layout shift | Stable existing grid/aspect-ratio dimensions; no width/height animation |
| Scroll jank | Observer disconnects after first reveal; transforms/opacity only |
| Excessive shadow work | Elevated hover is limited to interactive cards and fine pointers |
| Hidden content without JavaScript | Server output is visible until the client enables reveal behavior |
| Vestibular/accessibility impact | Global reduced-motion override and explicit E2E coverage |

## Library decision

Framer Motion was not added. CSS and the browser IntersectionObserver API cover
the requested interactions with less runtime JavaScript, no new supply-chain
surface and no migration of existing Server Components.
