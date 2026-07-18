# Technician Portal Audit

Ngày audit: 2026-07-18

## 1. Current Architecture

247 Home dùng Next.js App Router. Technician area thực tế nằm tại
`app/technician`, không có route group `app/(technician)`. `app/technician/layout.tsx`
guard role `TECHNICIAN` tại server và render `TechnicianLayout`, gồm shared Header,
navigation và bottom navigation cho mobile.

Trước thay đổi, `/technician` render một client component chứa cả danh sách,
detail modal, workflow action, notes hoàn thành và evidence. Backend flow đã hoàn
thiện nhưng frontend chưa có các public route được yêu cầu
`/technician/orders` và `/technician/orders/[id]`; bảng desktop và modal dài cũng
không phù hợp cho công việc ngoài hiện trường.

## 2. Existing API Contract

| Capability | Endpoint | Authorization / behavior |
|---|---|---|
| Own assignment list | `GET /api/v1/technician/assignments` | Requires TECHNICIAN; query is scoped by authenticated technician user ID; cursor pagination and status filter |
| Own assignment detail | `GET /api/v1/technician/assignments/{id}` | Returns 404 unless assignment belongs to current technician |
| Allowed actions | `GET /api/v1/technician/assignments/{id}/actions` | Returns only actions valid for current persisted state and actor |
| Execute action | `POST /api/v1/technician/assignments/{id}/actions` | Server validates ownership, state and `expectedVersion`; mutation and audit are transactional |
| Upload evidence | `POST /api/v1/technician/assignments/{id}/evidence` | Owner + active assignment only; validated image and compensated storage transaction |
| Preview evidence | `GET /api/v1/operations/evidence/{id}` | Owner technician or Operations role; private/no-store; no physical path exposed |

Authenticated responses use `Cache-Control: private, no-store`. Mutation routes
also enforce origin, content type, body limit and rate limit through the shared
Operations mutation wrapper.

## 3. Data Exposure

The list DTO intentionally exposes only order number, schedule, service area and
status. It does not expose customer data. Detail adds only data needed for field
work: recipient name, installation address, product snapshot, service package
name and customer note. Payment, internal admin data and unrelated assignments
are not returned.

The new requirement asks for customer basic information in the list. That cannot
be added without changing the API DTO, so customer data remains detail-only to
preserve the existing privacy contract.

## 4. Workflow Mapping

Appointment state is the technician workflow source of truth:

```text
ASSIGNED
  -> EN_ROUTE
  -> ARRIVED
  -> IN_PROGRESS
  -> COMPLETED
```

`accept` records `acceptedAt` and intentionally leaves appointment state at
`ASSIGNED`. The backend coordinates order side effects: starting installation
moves the order to installation in progress when its guard is satisfied, and
completion atomically completes appointment/order and writes audit events.

The requested phrase `READY_FOR_INSTALLATION -> EN_ROUTE` mixes order state with
appointment state. The client must display the appointment state and send action
intent; it must not invent a cross-aggregate transition.

## 5. Evidence and Notes

- Evidence is linked to the technician assignment, which links to appointment and
  order. Storage keys are generated server-side and never exposed.
- Server validates MIME, extension, signature and five-megabyte limit.
- Database failure triggers object compensation; existing integration tests cover
  orphan cleanup.
- The current API supports a result note only as part of the `complete` action.
  There is no standalone save-note endpoint. The UI must not imply draft notes
  are persisted before completion.

## 6. UI Gaps Found

- No `/technician/orders` and `/technician/orders/[id]` route architecture.
- Long modal forced detail and action controls into one scroll surface.
- Desktop table caused unnecessary horizontal interaction on mobile.
- Raw enum values had weak visual hierarchy.
- Timeline was plain text and did not distinguish completed/upcoming steps.
- Action buttons and upload controls were not consistently tap-sized.
- No route-level IDOR E2E or portrait/landscape detail verification.

## 7. Recommended Scope

1. Redirect `/technician` to `/technician/orders`.
2. Use mobile-first assignment cards and server cursor pagination.
3. Use a dedicated detail route where `[id]` is the assignment ID required by the
   existing API contract.
4. Render only actions returned by `/actions`; send `expectedVersion` for every
   mutation and refresh after success/conflict.
5. Keep result notes explicitly tied to completion.
6. Keep evidence upload/preview within the existing authorized endpoints.
7. Preserve `TechnicianLayout` as a separate role surface.

## 8. Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Assignment ID is presented under an order-shaped route | Low | Document route semantics; API remains unchanged |
| Stale action after concurrent update | Medium | `expectedVersion`, server conflict, refetch detail/actions |
| Customer data appears in list | Medium | Preserve list DTO; show necessary PII only after authorized detail request |
| Draft note appears persisted | Medium | Label note as saved with completion action only |
| Evidence upload leaves orphan | Low | Reuse tested backend compensation path |

Audit conclusion: the backend already satisfies ownership, state, concurrency,
audit and evidence invariants. The required work is a frontend routing and mobile
experience refactor within the existing contract.
