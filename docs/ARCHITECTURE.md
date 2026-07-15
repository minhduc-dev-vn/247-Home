# 247 Home — Architecture

## 1. Architectural drivers

Thiết kế ưu tiên:

1. Toàn vẹn giá, tồn kho, đơn và lịch dưới concurrent requests.
2. Authorization, validation và business rules chỉ được tin khi chạy tại server.
3. Modular monolith dễ phát triển, test và vận hành cho MVP.
4. Audit được mutation quản trị mà không lưu dữ liệu nhạy cảm.
5. Ranh giới module rõ để giảm coupling; không dùng microservices.
6. Stack cố định: Next.js App Router, TypeScript strict, PostgreSQL, Prisma, Auth.js, Tailwind CSS, shadcn/ui, Zod, React Hook Form, Vitest, Playwright, Docker Compose, pnpm, GitHub Actions.
7. Giai đoạn hiện tại chỉ thiết kế; không deploy production.

## 2. Quyết định kiến trúc

| ID | Quyết định | Lý do | Hệ quả |
|---|---|---|---|
| ADR-001 | Modular monolith trong một Next.js application | Đủ quy mô MVP, transaction đơn giản, vận hành thấp | Module phải giữ ranh giới import và ownership dữ liệu |
| ADR-002 | PostgreSQL là source of truth | Cần ACID, row locking, constraint và transaction | Business invariant quan trọng phải có DB constraint khi khả thi |
| ADR-003 | Prisma cho truy cập dữ liệu thông thường; raw SQL có kiểm soát cho locking/constraint PostgreSQL chưa biểu diễn tốt | Giữ type safety nhưng không hy sinh concurrency correctness | Raw SQL phải parameterized, bọc repository và có integration test |
| ADR-004 | Server Components cho read-first UI; Route Handlers cho hợp đồng HTTP/mutation | Giảm JavaScript client, đặt trust boundary rõ | Không gọi domain mutation trực tiếp từ Client Component |
| ADR-005 | Giá được tính bởi pricing domain tại server | Client không đáng tin | Request checkout không chứa trường giá có hiệu lực |
| ADR-006 | Reservation inventory và booking slot trong transaction checkout | Ngăn oversell/overbooking | Cần lock order ổn định, retry lỗi transaction và idempotency |
| ADR-007 | RBAC cộng ownership/assignment checks | Role đơn thuần không ngăn IDOR | Mỗi use case định nghĩa policy cụ thể |
| ADR-008 | Audit append-only trong cùng transaction với admin mutation | Tránh mutation thành công nhưng thiếu audit | Audit failure làm rollback mutation được audit |
| ADR-009 | REST-style JSON `/api/v1` cho mutation và dữ liệu động | Hợp đồng rõ, dễ test Playwright/integration | Không thêm GraphQL/tRPC trong MVP |
| ADR-010 | VND lưu integer (`BIGINT`) | Tránh sai số số thực | API biểu diễn money bằng decimal string để tránh giới hạn JavaScript |
| ADR-011 | Timestamp lưu `timestamptz` UTC; hiển thị `Asia/Ho_Chi_Minh` | Nhất quán lịch | Slot request dùng ISO 8601 có offset hoặc ID slot |
| ADR-012 | Một kho logic, một appointment hiệu lực/order trong MVP | Giảm độ phức tạp | Mở rộng nhiều kho cần ADR/schema mới |
| ADR-013 | Không payment gateway; chỉ COD/chuyển khoản thủ công | Đúng phạm vi | Không lưu thẻ; payment update cần nhân sự được phép |
| ADR-014 | Optimistic version cho aggregate và pessimistic lock cho tài nguyên khan hiếm | Ngăn lost update và oversubscription | Client mutation gửi `expectedVersion` khi cần |
| ADR-015 | Combo MVP được bán qua service package gắn variant; bundle nhiều SKU cần duyệt thêm | Phù hợp bảng tối thiểu, tránh inventory bundle mơ hồ | Chưa coi package là SKU tồn kho độc lập |

## 3. System context

```text
Anonymous / Customer
        |
        | HTTPS
        v
+---------------------------------------+
| 247 Home Next.js Modular Monolith     |
| Storefront | Account | Admin | Tech   |
| Route Handlers | Application Modules  |
+---------------------------------------+
        |
        | Prisma + parameterized SQL
        v
+------------------+
| PostgreSQL       |
| source of truth  |
+------------------+

STAFF / TECHNICIAN / MANAGER / ADMIN
        |
        +------------- HTTPS ------------^
```

Không có microservice, message broker, payment gateway hoặc production infrastructure trong MVP. Email/SMS/object storage chưa được cam kết.

## 4. Container view

### 4.1 Web application

Một Next.js App Router process chứa:

- Server-rendered storefront.
- Customer account và checkout.
- Admin workspace.
- Technician workspace.
- Route Handlers `/api/v1`.
- Auth.js handlers/session.
- Application services và domain policies.
- Prisma adapter và PostgreSQL-specific transaction helpers.

### 4.2 PostgreSQL

Chứa:

- Identity/RBAC.
- Catalog/pricing.
- Cart/order/payment.
- Inventory.
- Service area/scheduling.
- Technician assignment.
- Warranty.
- Audit.

DB không được truy cập trực tiếp từ browser. Chỉ server process có credential DB.

### 4.3 Development/test tooling

- Docker Compose: PostgreSQL local/test; có thể chạy app local sau phase bootstrap.
- Vitest: unit và integration.
- Playwright: E2E qua browser.
- GitHub Actions: quality gates.
- pnpm: package manager duy nhất.

## 5. Cấu trúc dự kiến

Đây là cấu trúc thiết kế, chưa phải source code hiện có.

```text
247-home/
├─ app/
│  ├─ (storefront)/
│  ├─ (account)/
│  ├─ admin/
│  ├─ technician/
│  └─ api/v1/
├─ src/
│  ├─ modules/
│  │  ├─ identity/
│  │  ├─ catalog/
│  │  ├─ pricing/
│  │  ├─ cart/
│  │  ├─ checkout/
│  │  ├─ orders/
│  │  ├─ inventory/
│  │  ├─ service-areas/
│  │  ├─ installations/
│  │  ├─ technicians/
│  │  ├─ payments/
│  │  ├─ warranties/
│  │  └─ audit/
│  ├─ shared/
│  │  ├─ auth/
│  │  ├─ db/
│  │  ├─ errors/
│  │  ├─ http/
│  │  ├─ logging/
│  │  ├─ money/
│  │  ├─ time/
│  │  └─ validation/
│  └─ ui/
├─ prisma/
├─ tests/
│  ├─ integration/
│  ├─ concurrency/
│  └─ e2e/
├─ docs/
└─ .github/workflows/
```

### Quy tắc module

Mỗi module dự kiến có:

```text
module/
├─ domain/          # entity/value/policy/state transition thuần
├─ application/     # use case, command/query, transaction orchestration
├─ infrastructure/  # Prisma repository, adapter
├─ presentation/    # schema HTTP/mapper nếu cần
└─ index.ts          # public API của module
```

- Module khác chỉ import qua public API, không import infrastructure nội bộ.
- Route Handler gọi application use case, không chứa business rule phức tạp.
- React component không gọi Prisma.
- Repository không quyết định authorization.
- Application service thực thi authorization và phối hợp transaction.
- Domain không phụ thuộc Next.js, Prisma, React hoặc HTTP.
- Shared chỉ chứa primitive dùng thật sự chung; không tạo “god module”.
- Không tạo abstraction giả cho microservice hoặc distributed event bus.

## 6. Module boundaries và ownership

| Module | Trách nhiệm | Dữ liệu sở hữu | Phụ thuộc được phép |
|---|---|---|---|
| identity | Auth integration, user, role, policy context | users, roles, user_roles, Auth.js tables nếu dùng | audit |
| catalog | Product, variant, image, publish, package compatibility | products, product_variants, product_images, service_packages | inventory read, audit |
| pricing | Tính quote từ dữ liệu server | Không sở hữu bảng riêng MVP | catalog, service-areas |
| cart | Cart/item lifecycle | carts, cart_items | catalog, pricing |
| inventory | on-hand, reservation, consume/release, adjustment | inventory | catalog identity, audit |
| service-areas | Match địa chỉ với vùng, cấu hình vùng/capacity | service_areas và cấu hình slot theo schema được duyệt | audit |
| checkout | Orchestrate quote, inventory, slot, order/payment | idempotency thuộc orders hoặc bảng riêng nếu duyệt | cart, pricing, inventory, installations, orders, payments |
| orders | Order aggregate và state machine | orders, order_items | inventory, installations, payments, audit |
| payments | COD/chuyển khoản thủ công | payments | orders, audit |
| installations | Appointment, capacity, state machine | installation_appointments | orders, service-areas, technicians, audit |
| technicians | Technician profile và assignment | technicians, technician_assignments | identity, installations, audit |
| warranties | Warranty eligibility và lifecycle | warranty_requests | orders, audit |
| audit | Append-only admin audit | audit_logs | identity context only |

Sở hữu dữ liệu nghĩa là chỉ module đó được mutation trực tiếp. Module khác gọi application API hoặc transaction participant do module sở hữu cung cấp.

## 7. Request lifecycle

### 7.1 Query

1. Next.js Server Component hoặc Route Handler nhận request.
2. Parse query/path bằng Zod.
3. Tải session nếu tài nguyên không công khai.
4. Áp dụng policy và scope query.
5. Gọi query service/repository.
6. Map DB model sang response DTO; loại dữ liệu nhạy cảm.
7. Trả response kèm correlation ID.

### 7.2 Mutation

1. Xác minh origin/CSRF strategy và content type.
2. Parse body/path/header bằng Zod; reject unknown field khi phù hợp.
3. Tải session mới từ server.
4. Xác định actor, role và resource scope.
5. Gọi application command.
6. Trong transaction: lock/check invariant, mutation và audit nếu là admin action.
7. Map domain error sang HTTP error chuẩn.
8. Structured log metadata đã redact; không log body nhạy cảm.

Validation không thay thế authorization. Authorization không dựa vào trạng thái nút trên UI.

## 8. Authentication

- Auth.js là lớp authentication duy nhất.
- Cấu hình provider cụ thể cần con người duyệt.
- Nếu dùng Credentials provider, password hash phải dùng thuật toán chuyên dụng được duyệt; không tự viết crypto.
- Session strategy cần được quyết định khi bootstrap:
  - Database session phù hợp revoke/role change nhanh.
  - JWT session cần chiến lược invalidation/version để role change có hiệu lực.
- Cookie trong môi trường phù hợp: `HttpOnly`, `SameSite=Lax` hoặc chặt hơn, `Secure` khi HTTPS.
- Session callback chỉ đưa user ID và role cần thiết; không đưa secret.
- Redirect/return URL phải allowlist nội bộ.
- Route protection ở layout/middleware chỉ cải thiện UX; use case vẫn authorization tại server.
- Không dựa riêng vào middleware vì Route Handler/application use case vẫn có thể bị gọi trực tiếp.

## 9. Authorization

### 9.1 Mô hình

Quyết định truy cập:

```text
allow = authenticated
        AND role permits action
        AND resource scope permits action
        AND current state permits action
```

- RBAC: role cho phép nhóm action.
- Ownership: CUSTOMER chỉ tài nguyên có `user_id` của mình.
- Assignment: TECHNICIAN chỉ appointment có active assignment gắn technician của mình.
- State policy: action chỉ hợp lệ tại trạng thái cho phép.
- Field policy: public note và internal note được tách khi trả DTO.
- Mặc định deny.

### 9.2 Ma trận quyền cấp cao

Ký hiệu: `R` đọc, `C` tạo, `U` action/update hợp lệ, `A` quản trị đầy đủ trong policy, `Own` dữ liệu sở hữu, `Assigned` dữ liệu được phân công.

| Resource/action | CUSTOMER | STAFF | TECHNICIAN | MANAGER | ADMIN |
|---|---|---|---|---|---|
| Catalog công khai | R | R | R | R | R |
| Catalog admin | — | C/U | — | A | A |
| Inventory | — | R/U theo quyền | — | A | A |
| Address | Own C/R/U | dữ liệu cần cho đơn | Assigned tối thiểu | R theo nghiệp vụ | A |
| Service area check | R | R | R | R | R |
| Service area config | — | R | — | A | A |
| Cart | Own C/R/U | — | — | — | hỗ trợ có kiểm soát |
| Order | Own R/cancel policy | R/U nghiệp vụ | Assigned tối thiểu | A nghiệp vụ | A |
| Payment confirm | — | U theo quyền | — | U | U |
| Appointment | Own R/reschedule policy | R/U | Assigned R/U giới hạn | A | A |
| Technician profile | — | R | Own R hạn chế | A | A |
| Assignment | — | C/U | Assigned R/action | A | A |
| Warranty | Own C/R | R/U | Assigned nếu được bổ sung | A | A |
| Audit log | — | — mặc định | — | R theo domain | R toàn bộ |
| User roles | — | — | — | R hạn chế | A |

Chi tiết endpoint là nguồn thực thi tại `API_CONTRACT.md`. Quyền STAFF cần được cấu hình thành permission cụ thể hoặc policy code; không được hiểu là toàn quyền admin.

### 9.3 Chống IDOR

- Không tải resource toàn cục rồi mới kiểm tra ở UI.
- Query customer có điều kiện `id AND user_id`.
- Query technician có điều kiện assignment active.
- Với tài nguyên không thuộc scope, ưu tiên `404 NOT_FOUND`.
- Admin query vẫn kiểm tra action permission.
- Test negative authorization bắt buộc cho từng resource.

## 10. Validation và data contracts

- Zod tại mọi input boundary: path, query, body, form, header nghiệp vụ và environment.
- React Hook Form dùng schema chia sẻ cho UX; server parse lại độc lập.
- Không truyền Prisma model trực tiếp ra client.
- DTO whitelist trường.
- String có max length; enum allowlist; ID theo định dạng thống nhất; pagination có giới hạn.
- Rich HTML không thuộc MVP. Nội dung mô tả xử lý dưới dạng text/markdown policy được duyệt để giảm XSS.
- Money input admin nhận decimal string biểu diễn số nguyên VND rồi parse/range-check sang `bigint`.
- API trả money dạng string, ví dụ `"1250000"`.
- Date/time dùng ISO 8601; booking ưu tiên nhận immutable slot/capacity ID sau khi schema slot được duyệt.
- Unknown fields trong command quan trọng bị reject.

## 11. Pricing architecture

Pricing service là pure calculation quanh snapshot server:

```text
QuoteInput (IDs + quantities + address/service area)
  -> load active variants/packages from DB
  -> validate compatibility and quantity
  -> calculate line totals and fees
  -> return Quote with fingerprint/version
```

Quy tắc:

- Không nhận giá client làm đầu vào tính toán.
- Quote hiển thị không phải reservation.
- Checkout load lại toàn bộ entity và tính quote trong transaction.
- `order_items` lưu snapshot tên, SKU, package, unit price và line total.
- `orders` lưu subtotal, installation fee, shipping fee, discount total, grand total và currency.
- Tổng được kiểm tra bằng domain invariant trước insert.
- Thay đổi catalog sau checkout không sửa đơn cũ.
- Nếu dùng quote fingerprint, fingerprint chỉ để phát hiện thay đổi; không thay thế việc tính lại.

## 12. Concurrency và transaction

### 12.1 Checkout transaction

Mức isolation và primitive cuối cùng phải được chứng minh bằng integration test PostgreSQL. Baseline:

1. Xác nhận idempotency record/key.
2. Lock cart active.
3. Load item IDs.
4. Lock inventory rows bằng `SELECT ... FOR UPDATE` theo `product_variant_id` tăng dần.
5. Tính lại giá và kiểm tra trạng thái bán.
6. Kiểm tra `on_hand - reserved >= requested`.
7. Tăng `reserved`.
8. Lock capacity row của vùng/slot nếu cần.
9. Kiểm tra booked count/counter dưới capacity và ghi booking.
10. Insert order, item snapshots, payment và appointment.
11. Đóng cart.
12. Commit.

- Không gọi network trong transaction.
- Lock theo thứ tự ổn định để giảm deadlock.
- Retry có giới hạn cho deadlock/serialization failure.
- Retry chỉ an toàn khi idempotency được giữ.
- Transaction timeout hữu hạn.

### 12.2 Inventory lifecycle

- Checkout: `reserved += quantity`.
- Cancel trước consume: `reserved -= quantity`.
- Consume tại mốc được duyệt: `reserved -= quantity`, `on_hand -= quantity`.
- Mỗi order item cần cờ/thông tin lifecycle đủ để không release/consume hai lần; thiết kế cụ thể ở `DATABASE_DESIGN.md`.
- DB check constraint giữ invariant.
- Manual adjustment lock row, yêu cầu reason và audit.

### 12.3 Slot capacity

Thiết kế cần một capacity record có thể khóa cho `(service_area, service_date, start_at, end_at)`; bảng hỗ trợ được đề xuất trong `DATABASE_DESIGN.md`. Không dùng `COUNT` không khóa làm cơ chế duy nhất.

- Booking tăng counter hoặc insert dưới khóa capacity.
- Cancel/reschedule giải phóng đúng một lần.
- Reschedule khóa slot cũ/mới theo ID tăng dần.
- Capacity không được giảm dưới booking active.
- Appointment version ngăn lost update.

### 12.4 Technician conflict

PostgreSQL exclusion constraint trên khoảng thời gian cho assignment active là lựa chọn ưu tiên nếu tương thích migration/Prisma; nếu không, transaction lock + overlap query + constraint hỗ trợ. Application check đơn thuần không đủ.

### 12.5 Optimistic concurrency

Các bảng mutable quan trọng có `version integer`:

- orders
- inventory
- installation_appointments
- technician_assignments khi cần
- warranty_requests

Update dùng `WHERE id = ? AND version = expectedVersion`; không khớp trả `409 CONCURRENT_MODIFICATION`.

## 13. State machines

- Order transitions: `ORDER_STATE_MACHINE.md`.
- Installation transitions: `INSTALLATION_STATE_MACHINE.md`.
- API nhận **action** (`confirm`, `cancel`, `start`) thay vì state tùy ý.
- Transition table nằm trong domain code, có unit test exhaustive.
- Side effect inventory/payment/appointment nằm trong application transaction.
- Không cho admin bỏ qua state machine; emergency correction cần use case riêng, reason, quyền ADMIN và audit, nếu được duyệt.

## 14. Audit architecture

### Sự kiện bắt buộc

- Role assignment/removal.
- Product/variant/package create, publish, archive, price change.
- Inventory adjustment/reservation correction.
- Service area/capacity mutation.
- Order/payment transition do nhân sự.
- Appointment reschedule/cancel và technician assignment.
- Technician create/deactivate.
- Warranty transition/internal resolution.
- Các override nhạy cảm nếu được bổ sung.

### Thuộc tính

- `actor_user_id`, role snapshot.
- `action`.
- `target_type`, `target_id`.
- `request_id`.
- timestamp.
- reason khi action yêu cầu.
- `before`/`after` JSON đã allowlist/redact.
- IP/user-agent có thể lưu dạng giảm thiểu theo chính sách riêng tư được duyệt.

Audit insert chạy cùng transaction với mutation. Table không có application update/delete API. DB superuser vẫn có thể sửa nên “append-only” là kiểm soát ứng dụng, không phải bằng chứng bất biến tuyệt đối.

## 15. Error model

Domain/application error map sang envelope:

```json
{
  "error": {
    "code": "INVENTORY_INSUFFICIENT",
    "message": "Một hoặc nhiều sản phẩm không đủ tồn kho.",
    "fieldErrors": {},
    "details": {},
    "requestId": "req_..."
  }
}
```

- Message an toàn cho người dùng; không trả stack/SQL.
- `details` chỉ chứa dữ liệu allowlist.
- Mã HTTP: `400` malformed, `401` chưa đăng nhập, `403` thiếu quyền, `404` ngoài scope/không tồn tại, `409` conflict/state/concurrency, `422` semantic validation, `429` rate limit, `500` lỗi bất ngờ.
- Log server giữ exception với redaction và request ID.

## 16. Caching và rendering

- Catalog công khai có thể dùng server cache/revalidation sau khi cơ chế invalidation được test.
- Cart, checkout, order, payment, appointment, admin và technician data luôn dynamic/no-store.
- Authorization-sensitive response không dùng cache chia sẻ.
- Mutation catalog phải invalidate tag/path liên quan.
- Không cache giá checkout hoặc availability như source of truth.
- Search/filter state dùng URL.
- Client Component chỉ dành cho tương tác cần browser; ưu tiên Server Component.

## 17. Security controls

Chi tiết ở `THREAT_MODEL.md`. Baseline:

- Security headers, CSP theo nonce/hash khi cần.
- CSRF defense cho cookie-authenticated mutations: Auth.js protection nơi có và origin verification/token strategy cho custom API.
- Allowed methods/content types; giới hạn body.
- Rate limiting login, service check, checkout, warranty và admin-sensitive actions. Thiết kế local có adapter; production storage chưa thuộc phạm vi.
- Parameterized queries; raw SQL không nội suy.
- Output encoding mặc định React; không `dangerouslySetInnerHTML` cho nội dung không tin cậy.
- Redaction log/audit.
- Secret qua environment, validation khi startup; `.env` không commit.
- Dependency review, lockfile và CI security checks khi bootstrap.
- Không lưu PAN/CVV hoặc dữ liệu thẻ.
- Least privilege DB credential; migration credential tách runtime trong môi trường tương lai.
- Không chạy migration production hay deploy production.

## 18. Observability

- Structured JSON log có `timestamp`, `level`, `event`, `requestId`, `actorId`, `resourceId`, duration và outcome.
- Không log raw request body mặc định.
- Event quan trọng: auth failure, authorization denial, checkout conflict, transaction retry, inventory shortage, slot conflict, payment confirmation và admin mutation.
- Health endpoint chỉ báo process; readiness kiểm DB với timeout, không lộ version/credential.
- Audit log không thay application log.
- Metrics/tracing provider chưa được chọn; không thêm dependency trước khi giải thích và duyệt.

## 19. Testing architecture

### Unit — Vitest

- Money/pricing.
- Zod schemas.
- Authorization policies.
- Order/installation state transition tables.
- Warranty eligibility.
- Mapper/redaction.

### Integration — Vitest + PostgreSQL thật

- Prisma repositories và constraints.
- Checkout transaction.
- Idempotency.
- Inventory reserve/release/consume.
- Slot booking/reschedule.
- Technician overlap.
- Audit cùng transaction.
- Negative authorization.

Không dùng SQLite thay PostgreSQL cho test transaction/constraint.

### Concurrency

Dùng nhiều connection/request đồng thời:

- Một SKU còn 1, hai checkout: một thành công.
- Một slot còn 1, hai booking: một thành công.
- Cùng idempotency key: một order.
- Cancel/consume cạnh tranh: invariant giữ đúng.
- Hai assignment overlap: tối đa một active.
- Retry deadlock không nhân side effect.

### E2E — Playwright

- Catalog đến checkout COD.
- Checkout chuyển khoản thủ công.
- Theo dõi/hủy theo policy.
- Admin xử lý đơn và audit.
- Phân công, technician cập nhật, customer xem.
- Warranty.
- Role/ownership denial.

## 20. CI và local environment

GitHub Actions dự kiến:

1. Checkout và setup pnpm/Node phiên bản pin.
2. `pnpm install --frozen-lockfile`.
3. Lint.
4. Typecheck.
5. Unit test.
6. Khởi tạo PostgreSQL service, apply test migrations.
7. Integration/concurrency test.
8. Build.
9. Playwright trên artifact/build phù hợp.
10. Upload report không chứa secret.

Docker Compose chỉ phục vụ local/test. Không chứa production credentials. Migration chạy có chủ đích; không reset DB tự động.

## 21. Deployment boundary

MVP không deploy production. Tài liệu không chọn cloud/vendor production. Trước mọi production design cần review riêng về:

- Network/TLS/WAF.
- Managed PostgreSQL, backup/PITR.
- Secret manager.
- Object storage.
- Distributed rate limiting.
- Monitoring/on-call.
- Data retention, privacy và compliance.
- Migration/rollback production.
- Capacity/SLA và disaster recovery.

## 22. Các điểm cần con người duyệt

1. Auth provider và database session hay JWT session.
2. Permission chi tiết của STAFF; ai được xác nhận payment và chỉnh inventory.
3. Thời điểm consume inventory.
4. Mô hình slot/capacity và ngày nghỉ.
5. Combo là service package gắn variant hay bundle nhiều SKU.
6. Chính sách phí, hủy, đổi lịch và bảo hành.
7. Địa chỉ chuẩn hóa bằng dataset/provider nào.
8. Retention/redaction cho PII và audit.
9. Có cần public order timeline table/event history riêng.
10. Có cho customer checkout không đăng nhập trong phase sau.
11. Có cần upload ảnh bảo hành và storage nào.
12. Mục tiêu rate limit cụ thể; storage production chưa được thiết kế.