# Warranty & After-Sales Audit

> Historical frontend-only audit. Customer Warranty backend đã được triển khai sau
> báo cáo này; xem `docs/WARRANTY_BACKEND_AUDIT.md` và `docs/API_CONTRACT.md`. Customer
> UI vẫn là task riêng.

Ngày audit: 2026-07-18

## 1. Executive Conclusion

Customer Warranty cannot be implemented safely under the simultaneous constraints
of this task:

1. Customers must list, create and read their own warranty requests, upload
   evidence and track a server-authoritative workflow.
2. Backend, API, database and authentication must not be changed.

`docs/API_CONTRACT.md` explicitly marks Customer Warranty as **planned, not
exposed** and states that clients must not assume those routes are available.
Only Operations/Admin read endpoints exist. Creating customer UI against those
endpoints would either fail authorization or risk presenting cross-customer data.

Audit status: **WARRANTY IMPLEMENTATION BLOCKED BY MISSING SERVER CONTRACT**.

## 2. Route Audit

There is no `app/(customer)/warranty` directory and no `/warranty` route.
Customer routes are composed by `app/(customer)/layout.tsx`, so future Warranty
pages can inherit `CustomerLayout` without changing their public URLs.

Implemented Warranty HTTP routes:

| Method | Path | Authorization | Capability |
|---|---|---|---|
| GET | `/api/v1/admin/operations/warranties` | STAFF/MANAGER/ADMIN | Bounded admin queue |
| GET | `/api/v1/admin/operations/warranties/{id}` | STAFF/MANAGER/ADMIN | Admin detail |

Target routes documented but not implemented:

| Method | Path | Required authorization |
|---|---|---|
| GET | `/api/v1/warranty-requests` | CUSTOMER own only |
| POST | `/api/v1/warranty-requests` | CUSTOMER owns eligible order item |
| GET | `/api/v1/warranty-requests/{id}` | CUSTOMER owns request |

There are no customer warranty action, note, evidence upload or evidence preview
routes.

## 3. Available Data

### Customer order API

`GET /api/v1/orders` and `GET /api/v1/orders/{id}` are owner-scoped and expose:

- Order ID, order number, status, total and payment summary.
- Item ID, product name, variant name, quantity and line total.
- Appointment ID, status and schedule.

They do not expose:

- Service package name in the customer order DTO.
- Warranty duration or eligibility dates.
- Warranty requests for an order item.
- Warranty status, resolution, assignee or evidence.

The API can therefore display purchased products, but it cannot prove that a
product is eligible for warranty or whether an open request already exists.

### Admin warranty API

The admin queue exposes request number, status, issue type, order number and
creation date. Admin detail additionally exposes description, customer name,
product/variant and appointment summary. It is deliberately Operations-scoped
and cannot be reused by Customer UI.

## 4. Database Audit

The implemented `WarrantyRequest` model contains:

- `id`, `requestNumber`, `orderItemId`, `customerUserId`.
- `status`: `SUBMITTED`, `IN_REVIEW`, `RESOLVED`, `CLOSED`.
- `issueType`, `description`, optional `assignedStaffUserId`.
- `submittedAt`, `createdAt`, `updatedAt`.

Missing capabilities required by the prompt or approved design:

- No warranty duration snapshot on `OrderItem`; eligibility cannot be derived
  reliably from the historical purchase.
- No `completedAt`/eligibility expiry contract available in the DTO.
- No `version` for optimistic concurrency.
- No contact phone, public resolution or status timestamps.
- No warranty note model or public/internal note separation.
- No warranty evidence/attachment model.
- No technician relation for Warranty.
- No partial unique constraint or transactional idempotency rule preventing
  duplicate open requests for one order item.

The database design document describes some of these as recommended/target
fields, but the Prisma schema is the current implementation source of truth.

## 5. Workflow Audit

Implemented enum values:

```text
SUBMITTED -> IN_REVIEW -> RESOLVED -> CLOSED
```

No Warranty transition policy or mutation service exists. The prompt requests
`Pending`, `Technician Assigned`, `In Progress`, `Completed`, `Rejected`, but
`TECHNICIAN_ASSIGNED` and `REJECTED` do not exist in the implemented enum and
must not be invented by the client.

The Operations Admin UI is read-only for Warranty because no warranty mutation
endpoint is exposed.

## 6. Evidence and Attachment Audit

The current evidence model is `InstallationEvidence` and requires a
`TechnicianAssignment`. Upload authorization requires the currently assigned,
active technician. Preview authorization allows the owner technician or an
Operations role.

It cannot be reused for Customer Warranty because:

- Customer is not an authorized evidence actor.
- A warranty request may not have an installation assignment.
- Evidence would be linked to the wrong aggregate.
- PDFs/documents are not supported; installation evidence only accepts validated
  JPEG, PNG and WebP images.
- Warranty upload needs a separate threat-model and retention decision, already
  listed as open in `docs/THREAT_MODEL.md`.

## 7. Security Findings

| Finding | Severity | Reason |
|---|---|---|
| No customer ownership query for warranty | High blocker | Warranty content may contain PII; client filtering cannot replace server scope |
| No customer create authorization/eligibility use case | High blocker | Client cannot prove order-item ownership or warranty validity |
| No duplicate-open-request invariant | High blocker | UI disabling cannot prevent concurrent duplicate submissions |
| No warranty evidence authorization/storage contract | High blocker | Reusing installation evidence would violate aggregate ownership |
| Status contract differs from requested UI | Medium blocker | Client mapping would invent nonexistent states |
| No public/internal note separation | Medium blocker | Risk of exposing internal Operations text |

Calling Admin Warranty APIs from Customer pages is explicitly rejected. Fetching
all requests and filtering in the browser would be an IDOR/PII vulnerability.

## 8. Requirement Matrix

| Requirement | Current support | Status |
|---|---|---|
| List purchased products | Owner-scoped order API has partial item data | PARTIAL |
| Determine warranty eligibility | No historical warranty duration/eligibility contract | BLOCKED |
| List own warranty requests | Customer endpoint absent | BLOCKED |
| Create request | Customer mutation/use case absent | BLOCKED |
| Prevent duplicate requests | No server invariant/idempotency contract | BLOCKED |
| Warranty detail/timeline | Customer detail endpoint and transition history absent | BLOCKED |
| Technician information | No warranty-technician relation | BLOCKED |
| Notes | No customer-safe notes contract | BLOCKED |
| Evidence upload/preview | Warranty evidence model/endpoints absent | BLOCKED |
| Cross-customer denial test | Customer resource endpoint absent | BLOCKED |
| Responsive UI | Technically possible, but would have no valid data/mutations | DEFERRED |

## 9. Required Approved Backend Slice

This section is a recommendation only; it was not implemented in this task.

1. Approve eligibility policy and snapshot warranty duration on order items.
2. Approve Warranty state machine, including whether assignment/rejection states
   exist and which transitions are customer-visible.
3. Add owner-scoped list/detail/create application services and APIs.
4. Add transactional duplicate protection and idempotency for request creation.
5. Add versioned Operations Warranty actions and audit in the same transaction.
6. Design Warranty notes with public/internal separation.
7. Threat-model and implement Warranty evidence storage, authorization, MIME/size
   limits, cleanup and retention.
8. Add PostgreSQL integration/concurrency tests and customer IDOR E2E before
   exposing the UI.

Only after that contract is approved should `/warranty` and `/warranty/[id]` be
implemented against real endpoints.

## 10. Decision Needed

A human owner must choose one path:

- Approve a separate backend Warranty vertical slice, then implement Customer UI;
  or
- Reduce the scope to a read-only “Purchased products and support information”
  page that does not claim warranty eligibility/request tracking.

The current request explicitly requires creation, status tracking and evidence,
so the read-only option does not meet its Definition of Done.
