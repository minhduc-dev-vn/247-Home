# 247 Home

> Release update (2026-07-23): the repository now includes Customer Warranty
> and VNPay integration code added after the 2026-07-15 MVP freeze. VNPay is
> **not approved for production** until real sandbox qualification, reconciliation
> alert verification, and Finance/Security approval are complete. Production
> uses AWS WAF as the shared rate limiter; local/test retain the in-memory
> adapter. Current P0 status and evidence are tracked in
> [`docs/P0_REMEDIATION_EVIDENCE.md`](docs/P0_REMEDIATION_EVIDENCE.md).

Ứng dụng thương mại điện tử bán thiết bị nhà thông minh và an ninh gia đình kèm dịch vụ lắp đặt tận nơi.

> Trạng thái: **staging release candidate**. Phạm vi acceptance đã được freeze
> tại [`docs/MVP_SCOPE_FREEZE.md`](docs/MVP_SCOPE_FREEZE.md); chưa có production
> deployment.

## 1. Phạm vi staging MVP đã freeze

Release staging này chỉ nghiệm thu các capability đã triển khai và được liệt kê
trong [`docs/MVP_SCOPE_FREEZE.md`](docs/MVP_SCOPE_FREEZE.md). Product
Requirements rộng hơn là roadmap, không phải claim rằng endpoint đã tồn tại.

### Sản phẩm

- Camera an ninh.
- Chuông cửa có hình.
- Wi-Fi mesh.
- Khóa cửa thông minh.
- Combo thiết bị kèm công lắp đặt.

### Customer

- Xem sản phẩm, biến thể và combo.
- Kiểm tra khu vực hỗ trợ lắp đặt.
- Quản lý giỏ hàng và địa chỉ.
- Chọn ngày/khung giờ lắp đặt.
- Đặt hàng bằng COD hoặc chuyển khoản thủ công.
- Theo dõi đơn và lịch lắp đặt.

### Operations

- Quản lý catalog, giá, biến thể và tồn kho.
- Quản lý vùng phục vụ; capacity slot hiện được thực thi ở checkout/database.
- Quản lý order/payment và lịch lắp đặt.
- Quản lý/phân công kỹ thuật viên.
- Xem hàng đợi và chi tiết bảo hành đã có sẵn (read-only).
- Xem audit log theo quyền.

Deferred khỏi staging MVP: customer warranty API, warranty mutation, customer
order cancellation, admin role management và admin installation-slot CRUD.

Ngoài MVP: payment gateway thật, lưu thông tin thẻ, microservices, mobile native và production deployment.

## 2. Stack cố định

- Next.js App Router.
- TypeScript strict mode.
- PostgreSQL.
- Prisma.
- Auth.js.
- Tailwind CSS.
- shadcn/ui.
- Zod.
- React Hook Form.
- Vitest.
- Playwright.
- Docker Compose.
- pnpm.
- GitHub Actions.

Không đổi stack nếu chưa có ADR và phê duyệt.

## 3. Kiến trúc tóm tắt

247 Home dùng **modular monolith**. Business modules dự kiến:

- Identity.
- Catalog.
- Service Areas.
- Inventory.
- Cart.
- Pricing.
- Checkout.
- Orders.
- Payments.
- Installations.
- Technicians.
- Warranties.
- Audit.

Mỗi module phân lớp domain, application, infrastructure và presentation. Next.js Route Handlers/Server Actions là adapter; business rule không nằm riêng trong component hoặc route.

Nguyên tắc bất biến:

- Validation mọi input tại server.
- Authentication, role, ownership và assignment authorization tại server.
- Client không quyết định giá hoặc tổng tiền.
- VND lưu integer; JSON money dùng decimal string.
- Checkout tính lại giá và lưu snapshot.
- Inventory và slot booking dùng PostgreSQL transaction/locking/constraint.
- Checkout có idempotency; mutation aggregate có expected version.
- Mutation quản trị có audit trong cùng transaction.
- Không lưu password/token/card data trong log hoặc business data.
- Không microservices.

Chi tiết: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 4. Vai trò

| Role         | Phạm vi baseline                                             |
| ------------ | ------------------------------------------------------------ |
| `CUSTOMER`   | Catalog, cart, dữ liệu và order/appointment own              |
| `STAFF`      | Vận hành theo permission cụ thể                              |
| `TECHNICIAN` | Appointment có active assignment                             |
| `MANAGER`    | Quản lý vận hành, assignment và audit theo scope             |
| `ADMIN`      | Quản trị role/hệ thống; vẫn phải theo validation/state/audit |

Role không thay ownership/assignment check. UI guard không thay server authorization.

## 5. Tài liệu

| Tài liệu                                                                                                       | Nội dung                                                 |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`docs/PRODUCT_REQUIREMENTS.md`](docs/PRODUCT_REQUIREMENTS.md)                                                 | Mục tiêu, scope, yêu cầu và P0/P1/P2                     |
| [`docs/USER_FLOWS.md`](docs/USER_FLOWS.md)                                                                     | Luồng customer/admin/technician và failure paths         |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                                 | Modular monolith, module boundary, transaction, security |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md)                                                           | Bảng, quan hệ, constraint, index và concurrency          |
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)                                                                 | HTTP contract, endpoint, schema và error                 |
| [`docs/ORDER_STATE_MACHINE.md`](docs/ORDER_STATE_MACHINE.md)                                                   | Trạng thái/action/guard order                            |
| [`docs/INSTALLATION_STATE_MACHINE.md`](docs/INSTALLATION_STATE_MACHINE.md)                                     | Trạng thái/action/guard appointment                      |
| [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)                                                                 | STRIDE, abuse cases và security controls                 |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)                                                   | Phase và vertical slices                                 |
| [`docs/DEFINITION_OF_DONE.md`](docs/DEFINITION_OF_DONE.md)                                                     | Quality/security/test gates                              |
| [`docs/decisions/ADR-001-identity-local-credentials.md`](docs/decisions/ADR-001-identity-local-credentials.md) | Quyết định Auth.js local/test, session và rollback       |
| [`AGENTS.md`](AGENTS.md)                                                                                       | Quy tắc bắt buộc khi thay đổi repository                 |

Thứ tự đọc đề xuất:

1. Product Requirements.
2. User Flows.
3. Architecture.
4. Database Design.
5. API Contract.
6. Hai state machine.
7. Threat Model.
8. Implementation Plan.
9. Definition of Done.
10. AGENTS.md trước khi triển khai.

## 6. Mô hình dữ liệu cấp cao

Các bảng business tối thiểu:

```text
users --< user_roles >-- roles
users --< addresses
users --1 carts --< cart_items
products --< product_variants --1 inventory
products/product_variants --< product_images
product_variants --< service_packages
users --< orders --< order_items
order_items --0..1 inventory_allocations >-- product_variants
orders --< payments
orders --0..1 installation_appointments
installation_appointments --< technician_assignments >-- technicians --1 users
order_items --< warranty_requests
users --< audit_logs (actor)
service_areas --< installation_slots --< installation_appointments
```

`installation_slots` và `inventory_allocations` bảo đảm capacity/reservation có lifecycle và ownership kiểm chứng được. Xem chi tiết, gồm chiến lược forward-fix cho reservation lịch sử không đối soát được, trong `DATABASE_DESIGN.md`.

## 7. Luồng checkout an toàn

1. Customer đăng nhập và gửi ID tham chiếu, address, payment method, slot cùng `Idempotency-Key`.
2. Server validation strict.
3. Server kiểm ownership và vùng phục vụ.
4. Transaction lock idempotency/order resources, inventory rows và slot theo thứ tự ổn định.
5. Server tải catalog/package/fee hiện hành và tính lại toàn bộ tiền.
6. Server kiểm/reserve inventory và slot.
7. Server tạo order, snapshots, payment và appointment nếu cần.
8. Commit; cart đóng sau khi mọi side effect thành công.
9. Request lặp cùng key/payload trả cùng order; payload khác trả conflict.

Không nhận `unitPrice`, `subtotal` hoặc `grandTotal` từ client.

## 8. State baseline

### Order

```text
PENDING_CONFIRMATION
  -> CONFIRMED
  -> PROCESSING
  -> READY_FOR_INSTALLATION
  -> INSTALLATION_IN_PROGRESS
  -> COMPLETED
```

`CANCELLED` chỉ từ trạng thái/policy cho phép. Inventory được consume nguyên tử khi `PROCESSING -> READY_FOR_INSTALLATION`, sau khi xác minh allocation của từng order item.

### Installation

```text
ASSIGNMENT_PENDING
  -> ASSIGNED
  -> EN_ROUTE
  -> ARRIVED
  -> IN_PROGRESS
  -> COMPLETED
```

Có nhánh `RESCHEDULE_REQUIRED` và `CANCELLED`. Checkout có lắp đặt khởi tạo `ASSIGNMENT_PENDING`; mọi transition còn lại do policy server quyết định.

## 9. Kế hoạch triển khai

MVP chia thành phase:

1. Chốt ADR.
2. Nền tảng và quality gates.
3. Identity/RBAC.
4. Catalog và vùng phục vụ.
5. Inventory.
6. Cart/server pricing.
7. Checkout COD, inventory concurrency.
8. Checkout lắp đặt, slot concurrency.
9. Order và chuyển khoản thủ công.
10. Technician/assignment/installation completion.
11. Warranty.
12. Audit, security, performance và internal release candidate.

Mỗi vertical slice trong [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) có:

- Phạm vi.
- File/module dự kiến.
- Database thay đổi.
- Security requirements.
- Acceptance criteria.
- Test cần có.
- Cách rollback.

## 10. Chạy local trên Windows

Yêu cầu: Node.js 24 LTS hoặc mới hơn, pnpm 10, Docker Desktop với Docker Compose v2. Không dùng credential production.

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm db:seed
# Generate a local NEXTAUTH_SECRET, add it to .env, then start the app.
# node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
pnpm dev
```

Mở `http://localhost:3000`. PostgreSQL local của project nghe ở port `5433` để không đụng PostgreSQL hiện có ở `5432`. Kiểm tra process ở `http://localhost:3000/api/health` và PostgreSQL ở `http://localhost:3000/api/ready`.

Giữ `TRUST_PROXY_HEADERS=false` khi chạy local. Chỉ bật ở staging sau khi ingress đáng tin cậy đã xóa header forwarding do client tự gửi và tự thiết lập giá trị chuẩn.

Các lệnh canonical:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

`pnpm test:integration` cần PostgreSQL local đang chạy và migration đã áp dụng. `pnpm db:down` chỉ dừng container, không xóa Docker volume. Không chạy reset database hoặc migration production.

### Local production demo bằng Docker

Stack demo chạy standalone production image, PostgreSQL và private MinIO mà
không cần AWS:

```powershell
pnpm install --frozen-lockfile
pnpm demo:up
```

Mở `http://127.0.0.1:3000`. Migration, seed và evidence mẫu chạy trong one-shot
`demo-tools` container trước khi app khởi động. Reset riêng database/bucket demo
bằng `pnpm demo:reset`; lệnh có allowlist local và không xóa Docker volume.

Xem tài khoản, scenario và troubleshooting tại
[`docs/LOCAL_DEMO_RUNBOOK.md`](docs/LOCAL_DEMO_RUNBOOK.md).

## 11. Dependencies production

| Dependency                                           | Mục đích, lựa chọn và rollback                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`, `react`, `react-dom`                         | Cung cấp App Router và runtime UI đã được stack phê duyệt. Không thêm chúng thì phải tự dựng web framework/renderer, không phù hợp. Runtime scope là toàn bộ ứng dụng; license MIT, maintenance bởi Vercel/Meta. Rủi ro supply chain được giảm bằng lockfile và CI frozen install. Rollback cùng manifest/lockfile khi chưa có deploy.            |
| `@prisma/client`                                     | Client type-safe để kiểm tra readiness và truy cập PostgreSQL ở server. Alternative là driver PostgreSQL/raw SQL riêng, làm tăng bề mặt persistence ở MVP. Chỉ chạy server-side; license Apache-2.0, maintenance bởi Prisma. Gỡ client cùng Prisma schema/migration adapter sau ADR thay thế.                                                     |
| `zod`                                                | Validate environment ở trust boundary; API mutation sẽ dùng lại ở slice sở hữu endpoint. Alternative là tự viết parser, dễ không nhất quán. Runtime nhỏ, license MIT, maintained bởi Zod. Gỡ khi thay validator theo ADR và chuyển toàn bộ schema.                                                                                                |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Bộ utility mà shadcn/ui sử dụng để compose class/button nhất quán. Alternative là string concatenation thủ công. Chỉ ở client bundle của component dùng chúng; license Apache-2.0/MIT/MIT, maintenance signals là release/package chính thức. Gỡ bằng cách thay các component shadcn bằng CSS/React thuần.                                        |
| `lucide-react`                                       | Icon cho UI placeholder và shadcn/ui, thay SVG tự vẽ. Chỉ bundle icon được import; license ISC, dự án được duy trì công khai. Gỡ bằng icon nội bộ hoặc text.                                                                                                                                                                                      |
| `next-auth`                                          | Auth.js Credentials provider quản lý CSRF, session JWT trong cookie `HttpOnly` và sign-in/sign-out flow. API nền tảng không có protocol/session layer tương đương; tự ký cookie bị loại vì tăng rủi ro. Chạy server/client tối thiểu; license ISC, stable v4 tương thích Next 16/React 19. Gỡ cùng route auth/session khi thay provider theo ADR. |
| `bcryptjs`                                           | Hash/verify password với bcrypt, thay vì tự viết crypto hoặc lưu plaintext. Chỉ chạy server-side; license BSD-3-Clause, API nhỏ và mature. Rollback chỉ cùng migration/application tương thích; không hạ hash về plaintext.                                                                                                                       |
| `react-hook-form`, `@hookform/resolvers`             | Quản lý form authentication và Zod UX validation; server vẫn validate độc lập. Alternative là controlled form tự viết. Runtime chỉ trên trang form; license MIT, dự án duy trì tích cực. Gỡ bằng React form thuần.                                                                                                                                |

Auth.js dùng Credentials provider trong local/test. JWT session được so `authVersion` tại server để password reset hoặc thay đổi role sau này vô hiệu hóa session cũ; provider email production, MFA và retention policy vẫn cần review trước production.

## 12. Quy tắc đóng góp

Đọc [`AGENTS.md`](AGENTS.md) trước mọi task.

Tóm tắt:

- Không tự đổi stack hoặc thêm production dependency không giải thích.
- Không xóa/reset DB; không migration/deploy production.
- Mọi API validation và authorization tại server.
- Mọi database change có migration và rollback plan.
- Không dùng `any` nếu không có lý do rõ.
- Không secret/credential/PII nhạy cảm trong source/log.
- Không bỏ qua test lỗi.
- Sau implementation luôn chạy lint, typecheck, test và build.
- Sau task liệt kê file sửa, test chạy và rủi ro còn lại.

## 13. Quyết định baseline quan trọng

- Modular monolith, một Next.js deployment unit và một PostgreSQL database.
- Server-authoritative pricing.
- VND integer với `bigint`; decimal string qua JSON.
- Catalog price mutable; order snapshot immutable.
- Một kho logic MVP.
- Một active cart/user.
- Tối đa một appointment/order và một active assignment/appointment baseline.
- Capacity explicit theo service area/date/time.
- Transaction + DB constraint cho inventory, slot và assignment.
- Idempotency key cho checkout.
- Optimistic version + row lock cho transition.
- COD/chuyển khoản thủ công; không gateway/card.
- Audit append-only cho mutation quản trị.
- Timestamp UTC, hiển thị `Asia/Ho_Chi_Minh`.
- PostgreSQL thật cho integration/concurrency tests.
- Không production deployment.

## 14. Cần con người duyệt trước các slice tiếp theo

Các quyết định chặn Slice 2–checkout:

1. Auth.js provider và database/JWT session strategy.
2. ID strategy chính xác.
3. Combo là bundle nhiều SKU hay service package gắn một variant.
4. State khởi tạo appointment.
5. Inventory consume ở mốc nào.
6. Chính sách confirm/hủy order cho COD và chuyển khoản.
7. Deadline/phí đổi hoặc hủy lịch.
8. Capacity tính theo số job hay duration.
9. Công thức phí giao hàng/lắp đặt.
10. Geographic code/address normalization.
11. Permission chi tiết của STAFF/MANAGER.
12. Điều kiện/thời hạn bảo hành.
13. COD được xác nhận paid ở mốc nào.
14. Có cần nhiều technician hoặc nhiều appointment/order.
15. Retention/anonymization cho PII và audit.
16. Có cần dual approval cho payment/inventory adjustment.
17. Recovery/MFA/step-up authentication cho ADMIN.
18. Notification channel; baseline hiện không tích hợp email/SMS.

Ghi quyết định accepted trong `docs/decisions/ADR-*.md`, rồi cập nhật mọi tài liệu bị ảnh hưởng trước migration.

## 15. Bootstrap Slice 1

- Next.js App Router chạy TypeScript strict mode qua pnpm.
- Tailwind CSS v4 và shadcn/ui baseline đã cấu hình tại `components.json`.
- Docker Compose có production-like app, PostgreSQL và private MinIO local; các
  volume được giữ lại khi dừng container.
- Prisma có technical marker; seed bổ sung catalog, user, order và dữ liệu
  Operations cho local development/test hoặc Render staging được xác nhận rõ
  ràng. Seed local bị chặn khi database không phải local.
- `GET /api/health` kiểm process; `GET /api/ready` kiểm PostgreSQL với timeout và không lộ cấu hình/credential.
- Error boundary, trang 404, security headers, test Vitest/Playwright và GitHub Actions CI đã có.
- Không có workflow deploy hoặc secret repository.

Rollback bootstrap: dừng Compose bằng `pnpm db:down`, revert application và lockfile cùng nhau. Không xóa volume hoặc reset database; technical marker có thể được giữ lại hoặc forward-fix bằng migration mới.

## 16. Identity and Access

- Đăng ký, đăng nhập, đăng xuất, quên/reset password, `/account` và `/admin` đã nằm trong Slice 2.
- Tạo `NEXTAUTH_SECRET` riêng cho local bằng lệnh ở phần chạy local; không commit giá trị đó.
- Local reset email được ghi vào `.local-outbox/`, thư mục bị ignore và chỉ hoạt động ngoài production.
- Seed local/test tạo `admin@example.com`, `manager@example.com`,
  `customer@example.com`, `technician1@example.com` và
  `technician2@example.com` với password công khai
  `LocalDemoOnly-247Home`. Render staging phải dùng `db:seed:staging`,
  `SEED_TARGET=staging`, confirmation cố định và `STAGING_DEMO_PASSWORD` mạnh
  từ secret của operator; password local công khai bị từ chối.

## 18. Product Catalog and Inventory

- Storefront: `/products` supports server-side pagination, category, text and VND price filters. `/products/{slug}` shows active variants, public stock availability and compatible installation packages.
- `POST /api/v1/service-areas/check` accepts `provinceCode` and `districtCode`; the server is authoritative for the match and fees.
- Admin catalog endpoints live below `/api/v1/admin`. `STAFF`, `MANAGER` and `ADMIN` can access catalog operations; only `MANAGER` or `ADMIN` can write a non-zero product or service-package price. Inventory adjustment requires `expectedVersion`, a reason, PostgreSQL row locking and an audit record in the same transaction.
- Delete endpoints archive/deactivate business records instead of hard-deleting catalog history.
- Local development image upload is a mock provider only. It accepts JPEG, PNG and WebP up to 2 MB after extension, MIME and file-signature validation, stores generated filenames in `.local-uploads/` and is disabled in production.
- `pnpm db:seed` creates 12 active demo products, 4 compatible installation
  packages, 3 customer-facing service areas and one isolated Operations demo
  area. It is restricted to local databases. `pnpm db:seed:staging` provides the
  same idempotent synthetic dataset only for an explicitly confirmed Render
  staging database and reads its password from the environment; neither command
  is a production seed.

No production dependency was added for this slice. Local image storage uses Node.js built-ins only; production object storage, malware scanning and signed delivery need a separate approved design before deployment.

### Catalog rollback

The migration is additive and does not alter Identity tables. Do not delete catalog rows or reset the database. To roll back application behavior, disable the new routes/pages or forward-fix with a new migration; retain product, inventory and audit rows for traceability.

## 19. Current limitations

- Payment is manual COD/bank-transfer reconciliation only; there is no payment
  gateway, card storage, or refund action.
- Docker demo evidence uses private MinIO through the same S3-compatible adapter.
  Staging evidence uses the private object-storage runtime contract in
  [`docs/STAGING_SECRET_MANAGEMENT.md`](docs/STAGING_SECRET_MANAGEMENT.md).
- The local/test rate limiter is in-memory. Production must inject a shared
  `RateLimiter` adapter before horizontal scaling.
- Customer warranty create/list/detail, warranty state mutations, customer
  order cancellation, admin role management and admin installation-slot CRUD
  are deferred khỏi staging MVP và không được expose bởi route hiện tại.

## 20. Scope after Slice 3

- Catalog, cart, checkout, order, manual payment and Operations are implemented.
- Operations currently provides order/payment transitions, appointment
  assignment/reschedule, technician workflow/evidence, read-only warranty queue
  and audit browsing. It does not provide warranty mutations or slot CRUD.
- Chưa có production deployment, production credential hay payment gateway.
- Staging vận hành theo single-instance assumption và runbook tại
  [`docs/STAGING_OPERATIONS_RUNBOOK.md`](docs/STAGING_OPERATIONS_RUNBOOK.md).
