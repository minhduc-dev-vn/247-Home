# Admin Operations Implementation Report

Ngày cập nhật: 2026-07-17

## 1. Architecture

The implementation keeps the existing composition:

```text
app/admin/layout.tsx
  -> AdminLayout (Header + role navigation + Sidebar)
    -> app/admin/operations/page.tsx (server role guard)
      -> OperationsConsole (client presentation and API intents)
        -> existing Operations REST endpoints
          -> server authorization, state machine, transaction and audit
```

No backend, API, Prisma schema, migration, authentication or business rule was
changed.

## 2. Components and UX

- Upgraded Operations overview with compact current-page metrics and clear tabs.
- Reused Card, Badge, Alert, Loading, EmptyState, Input, Select, Textarea, Table,
  Button, Breadcrumb and AdminLayout primitives.
- Added centralized Operations status presentation for every Prisma order,
  appointment and warranty state.
- Added server status filters plus explicitly scoped current-page order search,
  order date and appointment region/customer search.
- Added responsive table containers and page-level overflow protection.
- Improved order detail with customer/address, payment, items, installation,
  technician, audit timeline and policy-derived order actions.
- Added candidate technician search using the existing paginated endpoint.
- Kept confirmation, disabled/loading, conflict/error and refresh behavior for
  assignment, reschedule and order transition.
- STAFF does not see assignment, reschedule or audit controls; server still
  enforces every permission.

## 3. API Integration

- Lists remain cursor-paginated with a limit of 10 per request.
- Candidate technicians remain server-filtered by active state, service area and
  schedule conflict, with search and additional pages supported.
- Order action, assignment and reschedule submit only intent, reason and
  `expectedVersion`; no state transition or availability rule was copied into the
  client.
- Errors are rendered from structured server responses and successful data is
  refreshed from the server.

## 4. Tests

- `tests/unit/operations-presentation.test.ts` checks complete enum coverage and
  safe unknown-state fallback.
- `tests/e2e/admin-operations-dashboard.spec.ts` checks overview rendering,
  status/current-page filtering, order detail and 390/768/1440 page boundaries.
- Existing Operations E2E continues to cover manager assignment, reschedule
  conflict, STAFF denial, full technician completion, evidence upload/preview,
  audit and IDOR.
- Existing PostgreSQL integration suite continues to cover assignment,
  reschedule, overlap constraints, concurrency, audit, evidence authorization and
  cleanup.

Final verification on the current repository state:

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 21 files / 74 tests |
| `pnpm test:integration` | PASS, 7 files / 53 tests on PostgreSQL |
| `pnpm test:e2e` | PASS, 41/41 Chromium tests |
| `pnpm build` | PASS, Next.js production build |
| `docker compose --env-file .env.demo.example up --build -d app` | PASS, rebuilt application container healthy |

The full E2E run was executed after the final UI implementation against a fresh
Next.js server, not an older Docker image. The Docker application was rebuilt
afterward from the verified source.

## 5. Known Limitations

- Date, region, service and customer filters cannot be global until list APIs
  accept those query fields. The new local refinements apply only to the current
  server page and are labeled accordingly.
- Admin evidence listing/upload/delete is not available in the current contract.
  Technician upload and authorized preview remain unchanged.
- Assignment reassign/cancel/exclude and warranty mutation actions have no
  backend endpoints and are intentionally not fabricated in the UI.
- Server policy currently allows STAFF read access to Operations. Restricting all
  order visibility to Manager/Admin requires a separate backend authorization
  change.

## 6. Status

`ADMIN DASHBOARD & OPERATIONS UI READY FOR THE EXISTING API CONTRACT`

The broader requested status `ADMIN DASHBOARD & OPERATIONS UI READY` is blocked
by the documented API and authorization gaps above. This report does not claim
those unavailable capabilities are complete.

## 7. Manual Verification

The in-app visual browser was unavailable in the verification session. Playwright
did verify real rendering and interactions at 390, 768 and 1440 pixel widths,
including page-level overflow, but a human should still inspect:

1. Sign in as `manager@example.com` in the local demo.
2. Open `/admin/operations` and inspect all four tabs at desktop and mobile width.
3. Assign a suitable technician and confirm the new assignment in the row/audit.
4. Reschedule once to a valid slot and once to a slot taken concurrently.
5. Open an order detail and verify payment, items, appointment and action policy.
