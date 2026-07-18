# Technician Portal Implementation Report

Ngày cập nhật: 2026-07-18

## 1. Architecture

```text
app/technician/layout.tsx
  -> server TECHNICIAN guard
  -> TechnicianLayout (Header + mobile bottom navigation)
     -> /technician                  redirects to /technician/orders
     -> /technician/orders           TechnicianOrdersList
     -> /technician/orders/[id]      TechnicianOrderDetail
          -> existing Technician assignment/action/evidence APIs
             -> ownership + state machine + transaction + audit
```

No backend, API, Prisma schema, migration, authentication or authorization logic
was changed.

## 2. Workflow Mapping

The portal renders the persisted appointment workflow:

```text
ASSIGNED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED
```

Acceptance is a timestamp action while state remains `ASSIGNED`. Buttons are
rendered from the server action-options response. The client sends only action
intent, `expectedVersion` and the completion note when required.

## 3. Components Created or Refactored

- `TechnicianOrdersList`: status filter, cursor pagination, refresh, mobile job
  cards and route links.
- `TechnicianOrderDetail`: operational detail, customer/address, products/service
  packages, notes, evidence gallery/upload, timeline and sticky mobile action bar.
- `ConfirmDialog`: keyboard-accessible confirmation for state-changing actions.
- `JobTimeline` with pure presentation helper and unit coverage.
- `TechnicianLayout` navigation now points to `/technician/orders`.

## 4. API Integration

- List/detail remain scoped by the authenticated technician on the server.
- Detail and action options are loaded together from existing endpoints.
- Every action sends the current appointment `expectedVersion`.
- Success and conflict paths reload persisted detail/action data; the UI never
  assumes a mutation succeeded.
- No per-card action API fan-out is introduced. Actions live on detail because the
  list contract does not include server policy options.

## 5. Evidence and Notes

- Client validates file extension, MIME and size for immediate feedback; server
  validation remains authoritative.
- Upload uses the existing base64 JSON evidence endpoint and displays loading,
  success and structured error states.
- Preview uses the authorized evidence endpoint, never a filesystem/object path.
- Result note is capped at 1,000 characters and is sent only with completion, as
  defined by the current API.

## 6. Mobile UX Decisions

- Card list removes horizontal table navigation.
- Primary targets are at least 44 pixels high.
- Action controls remain reachable above the mobile bottom navigation.
- Long order numbers wrap instead of expanding the viewport.
- Portrait 390x844 and landscape 844x390 layouts are covered by E2E overflow and
  interaction checks.
- Timeline distinguishes persisted and upcoming steps without copying transition
  policy into the client.

## 7. Security

- Every route is under the server-guarded Technician layout.
- Direct detail URL for another technician renders a generic failure and no order
  or customer data.
- Direct detail/action/evidence API requests remain protected by assignment
  ownership checks and return 404 for out-of-scope resources.
- Customer/Admin flows and their layouts were not changed.

## 8. Test Results

Final verification on the current implementation:

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 22 files / 76 tests |
| `pnpm test:integration` | PASS, 7 files / 53 tests on PostgreSQL |
| `pnpm test:e2e` | PASS, 42/42 Chromium tests |
| `pnpm build` | PASS, Next.js production build includes all three Technician routes |

The E2E suite verifies own-assignment pagination, full
`ASSIGNED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED` workflow,
completion note, evidence upload/preview, audit effects, direct URL/API IDOR
denial, optimistic concurrency and portrait/landscape mobile boundaries. The
same run also covers Customer and Admin regression flows.

## 9. Known Limitations

- `[id]` in `/technician/orders/[id]` is an assignment ID because the unchanged
  Technician API is assignment-oriented.
- Customer information remains detail-only; list API intentionally omits it.
- Notes cannot be saved independently before completion because no standalone
  notes endpoint exists.
- Push/in-app notifications were optional and no backend notification contract
  exists, so no fake client notification was added.

## 10. Status

`TECHNICIAN PORTAL READY`
