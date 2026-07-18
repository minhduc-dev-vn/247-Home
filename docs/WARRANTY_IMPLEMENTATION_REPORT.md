# Warranty & After-Sales Implementation Report

> Historical frontend-only report. Backend blocker được giải quyết bởi Customer
> Warranty vertical slice; xem `docs/WARRANTY_BACKEND_AUDIT.md`. Báo cáo này không
> phải trạng thái readiness của backend hiện tại.

Ngày cập nhật: 2026-07-18

## 1. Status

**CUSTOMER WARRANTY & AFTER-SALES BLOCKED**

`CUSTOMER WARRANTY & AFTER-SALES READY` is not declared because the required
Customer APIs, ownership policy, eligibility invariant, workflow mutations and
Warranty evidence contract do not exist. The task simultaneously prohibits the
backend/API/database changes required to add them.

## 2. Work Completed

- Audited customer route architecture and `CustomerLayout` composition.
- Audited customer order list/detail DTOs.
- Audited implemented and planned Warranty API contracts.
- Audited Prisma Warranty model/status enum and database design differences.
- Audited Operations Warranty read services.
- Audited installation evidence authorization/storage boundaries.
- Audited existing Warranty/Operations tests and threat-model requirements.
- Produced the requirement and security matrix in `docs/WARRANTY_AUDIT.md`.

No application route or component was created because it would either be a fake
workflow, call an unauthorized Admin endpoint, or falsely present client-derived
eligibility as authoritative.

## 3. Architecture Finding

The future frontend location is valid:

```text
app/(customer)/layout.tsx
  -> CustomerLayout
     -> app/(customer)/warranty/page.tsx
     -> app/(customer)/warranty/[id]/page.tsx
```

However, these pages need an approved owner-scoped server contract before they
can safely render real Warranty data or submit mutations.

## 4. Data and Workflow Finding

- Customer order DTO provides partial purchased-product information only.
- Warranty request data is available only to Operations roles.
- Implemented statuses are `SUBMITTED`, `IN_REVIEW`, `RESOLVED`, `CLOSED`.
- No server Warranty state machine or transition endpoint exists.
- No warranty eligibility snapshot is implemented on order items.
- No customer-safe resolution/timeline data is exposed.

## 5. Evidence Finding

Installation evidence is assignment-owned and customer access is denied by
design. Warranty evidence requires a distinct aggregate, authorization policy,
storage lifecycle and security tests. PDFs/documents are outside the current
validated image-only evidence contract.

## 6. Security Decision

The implementation intentionally does not:

- Fetch Admin Warranty data from a Customer page.
- Filter an all-customer response in the browser.
- Infer ownership, eligibility or duplicate status from UI state.
- Store notes/evidence only in browser state.
- Reuse Technician installation evidence for Warranty.
- Invent requested statuses that are not in the backend enum.

These choices preserve the existing security boundaries and avoid an IDOR or
false-success customer experience.

## 7. Tests

No new Warranty E2E was created because there is no customer Warranty endpoint
or UI behavior to exercise. A test that mocked the missing workflow would violate
the requirement not to create fake data/API.

This turn changed documentation only. Application quality gates were not rerun;
the most recent full repository run before this audit passed lint, typecheck,
76 unit tests, 53 PostgreSQL integration tests, 42 E2E tests and build. Those
results are not presented as Warranty verification.

## 8. Required Follow-up

Approve and implement the backend slice listed in `docs/WARRANTY_AUDIT.md`, then
create the two Customer routes, responsive UI and mandatory E2E against real
owner-scoped endpoints.

## 9. Rollback

Documentation-only change. Rollback consists of removing these two new reports;
there is no database, API or runtime state to revert.
