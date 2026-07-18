# Frontend UI Audit

Date: 2026-07-16
Scope: `app/`, `src/components/`, `src/lib/`, frontend styles and hooks

## Executive summary

247 Home uses a sound application stack, but its original interface was a
functional prototype: pages owned their own layout, most controls repeated raw
Tailwind classes, role-specific destinations were not discoverable after login,
and the product had no shared responsive or feedback vocabulary.

The recommended structure has now been implemented without changing backend
logic, API contracts, database access or authentication policy. CSS tokens,
reusable UI primitives and role-aware server-rendered shells form the new
frontend foundation.

## Current technology

| Concern | Implementation |
| --- | --- |
| Framework | Next.js 16 App Router and React 19 |
| Language | TypeScript strict mode |
| Rendering | React Server Components by default; client components only for interactive forms and consoles |
| Styling | Tailwind CSS v4 with CSS custom-property tokens in `app/globals.css` |
| Component baseline | shadcn/ui configuration, CVA, `tailwind-merge` and Lucide icons |
| Forms | React Hook Form with Zod resolvers |
| Routing | File-system App Router routes under `app/` |
| Tests | Vitest, PostgreSQL integration tests and Playwright E2E |

There was no standalone `styles/` directory and no general `hooks/` directory.
The only existing hook was the authentication form hydration helper under
`src/components/auth/`.

## Route structure

- Public/customer: home, product list/detail, cart, checkout, account and order
  history/detail.
- Authentication: login, registration, forgot password and password reset.
- Administration: profile/overview, catalog, service areas and Operations.
- Technician: assigned-work console.
- API: route handlers under `app/api/`; these are outside the UI refactor.

## Original UI patterns

- Every page created its own `main`, header, width and spacing rules.
- The only general primitive was `Button`.
- Forms used repeated raw `input`, error and button classes.
- Tables, cards, status messages, empty states and pagination had local markup.
- Brand colors mixed CSS variables with literal red, green, gray and white
  values.
- Customer, admin and technician screens had no shared application shell.
- `/account` displayed identity fields but offered no role-specific route into
  Operations, Catalog or technician work.
- Home was a text-only placeholder rather than the usable product entry point.
- Mobile navigation and admin desktop information architecture were implicit.

## Risks identified

| Risk | Impact |
| --- | --- |
| Repeated visual classes | Inconsistent focus, error, spacing and disabled states |
| Missing role-aware navigation | Users successfully authenticate but cannot discover their workspace |
| Literal colors | Semantic states drift and are difficult to audit for contrast |
| Per-page layout | Responsive fixes must be repeated and can regress independently |
| Large feature consoles own primitives | New pages are likely to copy local feedback/table patterns |
| No documented component contract | Contributors cannot tell when to reuse or extend a primitive |

## Implemented structure

```text
app/
  globals.css                   design tokens and global foundations
  admin/layout.tsx              server-guarded admin route shell
  technician/layout.tsx         server-guarded technician route shell
src/components/
  layout/                       Container, Header, Footer, Sidebar and shells
  navigation/                   Navbar, Breadcrumb and Pagination
  ui/                           controls, feedback and data-display primitives
  auth/                         forms composed from UI primitives
  catalog|commerce|operations/  feature components; business behavior retained
public/images/
  smart-home-entryway.png       local home/auth product visual
```

## Architecture recommendations

1. Keep authorization in server guards and application services. Role-aware
   navigation is discoverability only and must never become an authorization
   boundary.
2. Add variants to existing primitives before creating a near-duplicate.
3. Keep domain-specific components in their feature folder; move a component to
   `ui/` only when its API is domain-neutral.
4. Use CSS tokens for every new brand or semantic color. Literal colors are
   allowed only for deliberate token implementation details.
5. Build mobile-first. Customer and technician actions must fit at 390 px;
   admin data views may scroll their table region, never the whole document.
6. Preserve Server Components for layout/data composition and add `use client`
   only at the interactive boundary.
7. Add accessibility and responsive assertions with every new P0 workflow.

## Out of scope

- No API, database, Prisma, Auth.js, authorization policy or business-state
  change was made.
- Existing feature consoles were not rewritten; they were integrated into the
  shared shells and can adopt additional primitives incrementally.
- No production dependency was added.
