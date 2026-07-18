# 247 Home UI Design System

Version: 1.0
Date: 2026-07-16

## Principles

- Trustworthy: important state and next actions are explicit.
- Operational: admin surfaces favor scanning, comparison and repeated action.
- Mobile-first: customer and technician workflows remain usable at 390 px.
- Secure by construction: UI visibility never replaces server authorization.
- Composable: domain-neutral primitives stay small; feature behavior stays in
  its module.

## Design tokens

Tokens live in `app/globals.css` and are consumed through CSS variables and
Tailwind arbitrary-value syntax.

### Color

| Token | Value | Purpose |
| --- | --- | --- |
| `--primary` | `#087f8c` | Trust and technology teal |
| `--primary-hover` | `#066a75` | Primary hover state |
| `--primary-soft` | `#e3f3f4` | Selected/icon background |
| `--secondary` | `#e9eef1` | Neutral controls and navigation |
| `--accent` | `#e5652f` | High-value CTA |
| `--background` | `#f4f7f8` | Application canvas |
| `--surface` | `#ffffff` | Cards, forms and navigation |
| `--foreground` | `#17242b` | Primary text |
| `--muted` | `#5c6b73` | Supporting text |
| `--success` | `#147a4b` | Successful operation |
| `--warning` | `#a35f00` | Attention or recoverable risk |
| `--error` | `#b83232` | Error or destructive action |
| `--info` | `#2563a6` | Neutral system information |

Each semantic color has a matching soft background token. Do not communicate
state with color alone; pair it with text and, where useful, an icon.

### Typography

| Role | Recommended classes |
| --- | --- |
| Display | `text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight` |
| Page heading | `text-3xl sm:text-4xl font-bold` |
| Section heading | `text-2xl sm:text-3xl font-bold` |
| Component heading | `text-lg font-bold` |
| Body | `text-base leading-7` |
| Small body | `text-sm leading-6` |
| Caption | `text-xs font-semibold` |

The base font stack is Arial/Helvetica/system sans-serif. Letter spacing stays
at zero. Large display type is reserved for the home hero, not dashboards.

### Spacing

| Token | Value |
| --- | --- |
| `--space-xs` | 4 px |
| `--space-sm` | 8 px |
| `--space-md` | 16 px |
| `--space-lg` | 24 px |
| `--space-xl` | 32 px |

Prefer Tailwind spacing values that map to this scale. Page sections generally
use 40-64 px vertical spacing; compact operational rows use 8-16 px.

### Radius and shadow

| Token | Value/use |
| --- | --- |
| `--radius-sm` | 4 px, badges and checkboxes |
| `--radius-md` | 6 px, controls and buttons |
| `--radius-lg` | 8 px, cards and dialogs |
| `--shadow-card` | Subtle elevated repeated item |
| `--shadow-modal` | Modal and toast elevation |

Do not exceed 8 px for ordinary cards and application controls.

## Responsive model

| Mode | Width | Primary behavior |
| --- | --- | --- |
| Mobile | `< 768 px` | Stacked content, scrollable header nav, technician bottom nav |
| Tablet | `>= 768 px` | Expanded header navigation and multi-column content |
| Desktop | `>= 1024 px` | Admin sidebar, dense tables and wider work surfaces |

Fixed-format tables own their horizontal overflow region. The document itself
must not overflow the viewport.

## Components

### Layout

- `Container`: centered responsive width and page gutters.
- `Header`: brand, responsive navbar and action area.
- `Footer`: compact customer footer.
- `Sidebar`: desktop operational navigation.
- `CustomerLayout`: public/customer shell.
- `AdminLayout`: desktop-first shell with role-resolved links.
- `TechnicianLayout`: mobile-first shell with bottom navigation.
- `AuthLayout`: focused authentication composition with product imagery.

### Buttons

- `Button`: base control with `intent`, `size` and `loading`.
- `PrimaryButton`: normal committed action.
- `SecondaryButton`: lower-emphasis or cancel action.
- `DangerButton`: destructive action that requires appropriate confirmation.

```tsx
<PrimaryButton loading={submitting} type="submit">
  Save
</PrimaryButton>
<SecondaryButton type="button">Cancel</SecondaryButton>
```

For navigation that looks like a button, apply `buttonVariants` to a Next.js
`Link`; do not nest a link inside a button.

### Forms

- `Input`, `Select`, `Textarea` and `Checkbox` provide consistent dimensions,
  focus rings, disabled states and surfaces.
- Labels remain explicit. Validation messages use `aria-describedby` and
  controls use `aria-invalid`.
- React Hook Form and Zod continue to own form state and client-side UX
  validation. Server validation remains authoritative.

```tsx
<label htmlFor="email">Email</label>
<Input id="email" type="email" aria-invalid={hasError} />
```

### Feedback

- `Alert`: inline semantic message (`info`, `success`, `warning`, `error`).
- `Toast` and `ToastViewport`: non-blocking transient feedback.
- `Loading`: labeled, accessible loading state.

Do not use browser `alert()` as the primary UX. Errors tied to a form remain
next to that form.

### Data display

- `Card`, `CardHeader`, `CardContent`, `CardFooter`.
- `Badge` for short status/role labels.
- `TableContainer` and `Table` for stable tabular structure.
- `EmptyState` for empty queues with an optional next action.

Cards represent individual repeated items or framed tools. Do not nest cards or
turn entire page sections into floating cards.

### Navigation

- `Navbar`: horizontal navigation using semantic `nav`/`ul` markup.
- `Breadcrumb`: current hierarchy and back-navigation context.
- `Pagination`: previous/next navigation with disabled semantics.

## Role-aware layouts

- Customer links: products; cart and orders when the actor has `CUSTOMER`.
- Staff/Manager/Admin links: Operations, Catalog, service areas and account.
- Admin-only overview link: `/admin`.
- Technician links: own jobs and account.

These links are generated from the server-resolved session actor. Every target
route retains its existing server guard, so hiding a link is not permission
enforcement.

## Visual asset

`public/images/smart-home-entryway.png` is a generated, project-local bitmap
used by Home and Auth layouts. It shows inspectable smart-home devices, contains
no text/logo and introduces no runtime network dependency.

Generation prompt summary: premium photorealistic Vietnamese apartment
entryway with installed security camera, video doorbell, smart lock and mesh
router; wide composition, natural daylight, neutral interior, restrained teal
and orange details, no people, logo, text or watermark. Generated with the
built-in image generation tool.

## Accessibility checklist

- Visible labels for every field.
- Keyboard-reachable links, buttons, tabs and dialogs.
- `focus-visible` ring on interactive controls.
- Loading and toast regions announced through status semantics.
- Errors use `role="alert"` and are associated with invalid fields.
- Icons are decorative unless they are the only button content.
- Reduced-motion preference disables non-essential animation.
- Text and controls remain within their container at mobile and desktop widths.

## Extension rules

1. Check for an existing primitive and variant first.
2. Keep component props domain-neutral under `ui/`.
3. Use Lucide icons rather than handwritten SVG.
4. Add a new token before repeating a new brand/semantic color.
5. Document a new public component in this file.
6. Add responsive and accessibility tests for new P0 views.
