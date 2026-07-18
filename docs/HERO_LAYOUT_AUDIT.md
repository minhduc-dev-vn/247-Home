# Hero Layout Audit

Date: 2026-07-16

## Current Structure

The customer hero is rendered directly by `app/page.tsx` inside
`CustomerLayout`. Before this fix it contained:

1. A Next.js `<Image fill>` element.
2. A full-section white overlay.
3. A content `Container` with the eyebrow, heading, description, and CTA.

All three nodes were children of one semantic `<section>`, but the rendered
layout did not preserve the intended layering.

## Root Cause

The production Content Security Policy blocks inline styles. Next.js implements
the `fill` image mode with inline positioning styles, so the browser discarded
the required `position: absolute`, dimensions, and inset declarations.

The resulting computed layout was:

- Hero image: `position: static`, 1440 x 960 pixels.
- Content container: started below the image at Y=1025.
- Hero section: expanded to 1569 pixels instead of the intended 608 pixels.

This created the visual result reported by the task: an image banner followed by
a separate text section. The issue was not caused by API data, authentication,
or the design tokens.

## Fix Approach

- Keep one semantic hero section.
- Stop relying on `<Image fill>` and its inline positioning styles.
- Use existing Tailwind classes for absolute positioning, dimensions, and
  `object-fit: cover`.
- Render a 640-pixel desktop composition with content on the left and the image
  layer on the right.
- Use `object-position: 70% center` to retain the camera, video doorbell, smart
  lock, and router.
- Below the desktop breakpoint, render content first and the image second inside
  the same section.
- Preserve the existing copy, CTA, design-system button, image asset, and public
  navigation behavior.

## Scope

No backend, API, database, product service, authentication, authorization, or
business-rule changes are required.
