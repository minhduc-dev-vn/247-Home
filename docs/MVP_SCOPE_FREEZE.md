# 247 Home Staging MVP Scope Freeze

> Historical decision notice (2026-07-23): this file preserves the scope frozen
> on 2026-07-15. Customer Warranty and VNPay were implemented later and are
> governed by their implementation records and
> `P0_REMEDIATION_EVIDENCE.md`. VNPay remains disabled for production release
> until external sandbox qualification and approval.

Decision date: 2026-07-15  
Decision: **Option A - freeze the implemented MVP for staging acceptance**

## 1. Decision

The staging release evaluates only the implemented capabilities below. Broader
requirements in `PRODUCT_REQUIREMENTS.md` remain product roadmap; they do not
imply that an HTTP endpoint or UI action exists in this release.

No deferred capability may be enabled by documentation, direct database edits,
or client-only controls. Moving a deferred item into the release requires a new
approved vertical slice with authorization, transaction/audit behavior and the
quality gates in `DEFINITION_OF_DONE.md`.

## 2. Scope matrix

| Area | Feature | Status | Acceptance boundary |
|---|---|---|---|
| Customer | Authentication and account | Included MVP | Register, login, logout, reset-password local adapter and own account |
| Customer | Product browsing | Included MVP | Paginated list/detail, variant, price, stock indication and compatible package |
| Customer | Cart | Included MVP | Own cart item add/update/remove and server quote |
| Customer | Checkout | Included MVP | Address, service-area/slot validation, COD or bank transfer, idempotent order creation |
| Customer | Order tracking | Included MVP | Paginated own order list and own order detail with appointment/payment summary |
| Payment | Payment creation | Included MVP | Payment snapshot is created transactionally with checkout |
| Payment | Manual confirmation | Included MVP | Authorized staff action, optimistic concurrency and transactional audit |
| Installation | Booking | Included MVP | Capacity-guarded appointment creation during checkout |
| Installation | Assignment | Included MVP | Manager/Admin assigns a suitable technician without overlap |
| Installation | Technician workflow | Included MVP | ASSIGNED through COMPLETED without skipping ARRIVED |
| Installation | Evidence | Included MVP | Authorized local/test upload and preview only; production storage is not included |
| Installation | Audit | Included MVP | Sensitive Operations mutations write redacted audit events transactionally |
| Admin | Order management | Included MVP | Paginated list/detail and policy-provided valid state actions |
| Admin | Installation management | Included MVP | Appointment list/detail, assignment and reschedule |
| Admin | Payment management | Included MVP | Policy-provided manual payment actions |
| Admin | Warranty queue | Included MVP | Read-only list/detail for existing requests |
| Customer | Warranty create/list/detail | Deferred | Requires a separate Warranty vertical slice |
| Admin | Warranty mutations | Deferred | No state/action endpoint is exposed |
| Customer | Order cancellation | Deferred | No customer cancellation route is exposed |
| Admin | Role management | Deferred | Roles authorize existing requests; role mutation is not exposed |
| Admin | Installation-slot CRUD | Deferred | Slots are seeded/read for checkout; admin CRUD is not exposed |
| Platform | Payment gateway/card handling | Not Planned | Manual COD/bank transfer only; card data is never collected |
| Platform | Production deployment | Not Planned | This decision covers staging readiness only |

## 3. Acceptance criteria

The frozen staging MVP is accepted only when:

- A fresh database applies every migration and the development seed twice.
- Lint, strict typecheck, unit, PostgreSQL integration, migration upgrade, full
  Playwright and production build gates pass on the reviewed commit.
- Customer ownership, technician assignment, admin role policy, price,
  inventory, slot, payment and optimistic-concurrency tests remain green.
- No Critical or High finding is open.
- Staging uses the documented single-instance, HTTPS, secret, backup, logging
  and rollback assumptions in `STAGING_OPERATIONS_RUNBOOK.md`.
- Deferred routes remain unavailable and are not represented as implemented.

## 4. Future roadmap

1. Warranty customer APIs and authorized/audited warranty state transitions.
2. Customer cancellation with inventory/slot lifecycle compensation.
3. Admin role management with last-admin and session-revocation invariants.
4. Admin slot CRUD with capacity/version/audit protection.
5. Approved production object storage, shared rate limiting and production
   deployment architecture.

## 5. Change control

The release manager owns this freeze. Product scope changes require written
Product Owner approval and a revised scope matrix. Engineering must not treat a
planned API example as implementation authorization.
