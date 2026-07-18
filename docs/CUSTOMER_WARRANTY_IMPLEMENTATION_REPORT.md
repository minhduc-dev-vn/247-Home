# Customer Warranty & After-Sales UI Implementation Report

## 1. Status

**CUSTOMER WARRANTY & AFTER-SALES UI READY**

Customer Warranty UI sử dụng backend warranty hiện hữu, không thay đổi Prisma schema, database architecture, authentication hoặc state machine. Hai route `/warranty` và `/warranty/[id]` nằm trong shared CustomerLayout.

## 2. Architecture

```text
app/(customer)/layout.tsx
  -> CustomerLayout
    -> /warranty
       -> owner-scoped listWarrantyRequests
       -> server-verified listEligibleWarrantyItems
       -> POST /api/v1/warranty
    -> /warranty/[id]
       -> owner-scoped getWarrantyRequest
       -> owner-scoped listWarrantyAudit
       -> POST evidence / PATCH state / authorized preview
```

- Server Components tải list, detail, eligibility và audit; dữ liệu riêng tư không được nhúng từ client fetch hoặc cache công khai.
- Client Components chỉ quản lý form state và gửi mutation intent với `expectedVersion`/`Idempotency-Key`.
- Backend tiếp tục là nguồn sự thật cho eligibility, ownership, state, timestamp, evidence và audit.

## 3. Components

| Thành phần | Trách nhiệm |
| --- | --- |
| `WarrantyCreateForm` | Chọn hạng mục server xác nhận eligible, mô tả vấn đề, gửi create idempotent |
| `WarrantyEvidenceUploader` | Client validation JPEG/PNG/WebP và 5 MB, upload qua API, refresh version |
| `WarrantyCloseAction` | Confirmation UX cho transition customer được phép sang `CLOSED` |
| `WarrantyStatusBadge` | Mapping trạng thái backend sang semantic badge |
| `WarrantyTimeline` | Hiển thị nhánh `RESOLVED` hoặc `REJECTED` chính xác, không coi hai trạng thái là tuần tự |

Loading, empty và error states sử dụng Design System hiện hữu. Customer navigation trỏ mục Bảo hành tới `/warranty`.

## 4. Data Mapping

List hiển thị request number, status, order number, product/variant, service package, coverage và submission date. Cursor pagination dùng contract `cursor + limit`, mỗi trang 8 items.

Detail hiển thị snapshot order item, installation package, warranty start/expiry, issue description, public resolution, contact snapshot, evidence metadata và redacted customer audit timeline.

Create options do `listEligibleWarrantyItems` tạo ở server bằng policy `evaluateWarrantyEligibility`. Projection có hard cap 100 order items, loại order không hoàn tất, warranty hết hạn, coverage đã tồn tại và dữ liệu của customer khác.

## 5. State Timeline

- Nhánh xử lý thành công: `SUBMITTED -> IN_REVIEW -> RESOLVED -> CLOSED`.
- Nhánh từ chối: `SUBMITTED -> IN_REVIEW -> REJECTED -> CLOSED`.
- Customer UI chỉ hiện action đóng khi backend state là `RESOLVED` hoặc `REJECTED`.
- Server vẫn kiểm tra owner, transition policy, current version và current state; UI condition không phải authorization boundary.

## 6. Evidence Handling

- File input chấp nhận JPEG, PNG và WebP, tối đa 5 MB để phản hồi UX sớm.
- API/storage layer kiểm tra lại MIME, signature, size, ownership và optimistic concurrency.
- Preview đi qua `/api/v1/warranty/:id/evidence/:evidenceId`; UI không nhận hoặc hiển thị physical storage path.
- Sau upload, page refresh lấy version và evidence metadata mới từ server.

## 7. UX And Accessibility

- Mobile-first; E2E kiểm tra ở viewport 390 x 844 và không có horizontal page overflow.
- Timeline có vùng cuộn ngang riêng trên mobile.
- Form control có label, error dùng `role=alert`, mutation button có disabled/loading state.
- Evidence có alt text và preview keyboard-focusable.
- Nội dung mô tả/kết quả render dạng plain text với `whitespace-pre-wrap`, không render HTML chưa sanitize.

## 8. Security Verification

- Pages yêu cầu role `CUSTOMER`; service list/detail/audit tiếp tục owner-scoped.
- Customer khác nhận 404 cho direct API và page URL; response/page không lộ request number hoặc description.
- UI không gọi Admin hoặc Technician endpoint.
- Create dùng `Idempotency-Key`; evidence và state mutation dùng `expectedVersion`.
- Mutation vẫn qua allowed-origin, content type, body limit và rate-limit middleware hiện hữu.

## 9. Tests

### Added or updated

- `tests/unit/warranty-presentation.test.ts`: timeline branch và accessible rendering.
- `tests/integration/warranty.test.ts`: server eligibility projection, owner filtering và duplicate removal.
- `tests/e2e/customer-warranty.spec.ts`: list/detail, create, timeline, upload/preview, close, audit, mobile overflow và IDOR.
- `tests/fixtures/warranty.ts`: Auth.js-capable test-only users/roles/password và namespace cleanup.

### Commands run on current repository

| Command | Result |
| --- | --- |
| `pnpm db:migrate` | PASS, 14 migrations, no pending migration |
| `pnpm lint` | PASS, zero warnings |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 24 files / 83 tests |
| `pnpm test:integration` | PASS, 9 files / 63 tests on PostgreSQL |
| `pnpm test:e2e` | PASS, 44/44 on a fresh Next.js server |
| `pnpm build` | PASS, production build includes both warranty routes |

## 10. Limitations

- Backend hiện có mô tả ban đầu và public resolution, chưa có customer comment-thread endpoint. UI không tự tạo comment API hoặc lưu note ngoài contract.
- Evidence list trong detail dùng backend cap 25 items; backend chưa cung cấp cursor riêng cho evidence.
- List pagination hỗ trợ next cursor; nút Previous quay về trang đầu theo navigation pattern hiện hữu của customer orders.
- Playwright ghi cảnh báo Next.js về `scroll-behavior: smooth`; cảnh báo không làm fail test và không thuộc warranty slice.
- Lần dựng lại Docker app sau kiểm thử gặp Docker Hub TLS handshake timeout khi resolve `docker/dockerfile:1.7`. Artifact `pnpm build` vẫn pass và đã được chạy bằng `pnpm start` tại `http://127.0.0.1:3000`; PostgreSQL và MinIO local vẫn healthy.

Không có ảnh hưởng phát hiện được tới Customer checkout/orders, Admin Operations hoặc Technician portal; full E2E regression đã pass.
