# Admin Operations UI Audit

Ngày audit: 2026-07-17

## 1. Current State

247 Home dùng Next.js App Router. Route Operations thực tế là
`app/admin/operations/page.tsx` và kế thừa `app/admin/layout.tsx`; không có route
`app/(admin)/operations`. `AdminLayout` hiện có Header, navigation theo role và
Sidebar responsive. Trang gọi `OperationsConsole` sau khi server guard xác nhận
actor có một trong các role `STAFF`, `MANAGER`, `ADMIN`.

Operations UI trước thay đổi đã có bốn queue đọc dữ liệu thật: order,
appointment, warranty và audit. UI cũng đã có order detail, order action theo
policy server, assignment, reschedule, confirmation dialog, loading/error/empty
state và cursor pagination. Vì vậy root cause không phải backend Operations bị
thiếu toàn bộ; vấn đề chính là presentation còn giống công cụ nội bộ sơ khai,
khả năng quét dữ liệu kém và một số yêu cầu mới vượt quá API contract hiện có.

## 2. Available Endpoints

| Capability | Endpoint | Server authorization | Query/mutation contract |
|---|---|---|---|
| Order list | `GET /api/v1/admin/operations/orders` | STAFF/MANAGER/ADMIN | `status`, `cursor`, `limit` |
| Order detail | `GET /api/v1/admin/operations/orders/{id}` | STAFF/MANAGER/ADMIN | Server-selected order/payment/appointment fields |
| Valid order actions | `GET /api/v1/admin/orders/{id}/actions` | STAFF/MANAGER/ADMIN | Policy-derived actions only |
| Order transition | `POST /api/v1/admin/orders/{id}/actions` | Policy checks actor/state | `action`, `expectedVersion`, `reason` |
| Appointment list | `GET /api/v1/admin/operations/appointments` | STAFF/MANAGER/ADMIN | `status`, `cursor`, `limit` |
| Suitable technicians | `GET /api/v1/admin/operations/technicians` | MANAGER/ADMIN | `appointmentId`, `search`, `cursor`, `limit` |
| Assign technician | `POST .../appointments/{id}/assign` | MANAGER/ADMIN | Technician, version and reason; server rechecks area/schedule |
| Reschedule | `POST .../appointments/{id}/reschedule` | MANAGER/ADMIN | Slot, version and reason; server rechecks capacity/conflicts |
| Warranty list/detail | `GET .../warranties[/{id}]` | STAFF/MANAGER/ADMIN | Status filter and cursor pagination |
| Audit list | `GET .../audit` | MANAGER/ADMIN | Action/target filters and cursor pagination |
| Evidence upload | `POST /api/v1/technician/assignments/{id}/evidence` | Assigned technician only | Validated image payload |
| Evidence preview | `GET /api/v1/operations/evidence/{id}` | Owner technician or Operations role | Authorized bytes, no storage path |

All sensitive mutations remain server-authorized, version guarded and audited.
The UI is not an authorization boundary.

## 3. State Model Used by UI

- Order: `PENDING_CONFIRMATION`, `CONFIRMED`, `PROCESSING`,
  `READY_FOR_INSTALLATION`, `INSTALLATION_IN_PROGRESS`, `COMPLETED`,
  `CANCELLED`.
- Appointment: `SCHEDULED`, `ASSIGNMENT_PENDING`, `ASSIGNED`, `CONFIRMED`,
  `EN_ROUTE`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`,
  `RESCHEDULE_REQUIRED`, `CANCELLED`.
- Warranty: `SUBMITTED`, `IN_REVIEW`, `RESOLVED`, `CLOSED`.

Client labels are presentation only. Allowed transitions continue to come from
server policy/action endpoints.

## 4. Missing UI and Contract Gaps

### UI gaps that can be fixed without backend changes

- Weak visual hierarchy and limited dashboard summary.
- Raw enum values instead of consistent status badges.
- No current-page search/date/region refinement.
- Candidate technician endpoint supports search but assignment dialog did not.
- Tables and action dialogs had limited responsive/accessibility polish.
- No focused unit test for Operations status presentation or dashboard E2E.

### Requirements blocked by the current API contract

- Exact global filters for order date, region, service package and customer name
  are not accepted by order/appointment list endpoints. Client-side filtering can
  only refine the current server page and must be labeled as such.
- Order detail does not expose service package or an evidence collection.
- Admin evidence list/upload/delete endpoints do not exist. Existing upload is
  intentionally technician-owned; preview requires an evidence ID.
- Reassign, cancel/exclude assignment and warranty mutation endpoints are not
  exposed. UI must not invent these actions.
- Existing approved policy allows STAFF to read all Operations lists/details,
  while the new prompt says only Admin/Manager should see all orders. Fixing this
  requires a server authorization/API contract decision and is prohibited by the
  current task.
- Accept/start/arrive/complete installation are technician workflow actions and
  remain in the separate technician portal.

## 5. Root Cause

The read and mutation foundations already exist. The gap is a combination of an
underdeveloped presentation layer and a request broader than the frozen backend
contract. Implementing global filters or admin evidence management purely in the
browser would create incomplete results or a client-only authorization illusion.

## 6. Recommended Frontend Scope

1. Keep `AdminLayout` and server route guards unchanged.
2. Upgrade `OperationsConsole` with the existing design system.
3. Preserve cursor pagination and server status filters.
4. Clearly mark search/date/region refinement as current-page behavior.
5. Add candidate search through the existing bounded endpoint.
6. Render only server-returned order actions and existing manager controls.
7. Keep evidence workflow in Technician UI until an admin evidence contract is
   approved.

## 7. Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| User assumes current-page search is global | Medium | Explicit scope copy beside filters |
| UI action becomes stale during concurrent update | Low | Send `expectedVersion`, show server error, refresh data |
| STAFF access differs from the new wording | Medium | Preserve server policy; request a separate security decision |
| Admin evidence requirement appears complete when it is not | Medium | Do not add fake controls; document contract gap |
| Customer or Technician flow regresses | Low | No route/backend changes; run full regression gates |

Audit result: frontend improvements are safe within the existing contract, but
the complete new capability list cannot be truthfully delivered without approved
backend contract changes.
