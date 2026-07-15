# 247 Home — API Contract

## 1. Phạm vi và quy ước

API nội bộ dùng JSON qua Route Handlers tại `/api/v1`. Tài liệu mô tả contract logic; OpenAPI có thể sinh ở phase implementation. Server Components có thể gọi application service trực tiếp cho query, nhưng phải giữ cùng validation, authorization và DTO.

- Content type mutation: `application/json`.
- Authentication: Auth.js session cookie.
- Mutation dựa trên cookie phải kiểm tra CSRF/origin.
- Mọi path, query, header và body được Zod parse tại server.
- Unknown field bị từ chối với command quan trọng.
- ID dùng CUID do Prisma sinh.
- Money là chuỗi số nguyên VND: `"1250000"`.
- Timestamp là ISO 8601 UTC.
- Pagination trả `{ items, nextCursor }`; cursor là CUID của bản ghi cuối,
  `limit` mặc định 25 và tối đa 100. Mọi query dùng `id` làm tie-breaker ổn định.
- Dữ liệu nhạy cảm trả theo role/ownership.
- Không endpoint nào nhận dữ liệu thẻ.

## 2. Envelope

### Thành công

Resource đơn:

```json
{
  "data": {},
  "meta": { "requestId": "req_123" }
}
```

Danh sách:

```json
{
  "data": [],
  "meta": {
    "requestId": "req_123",
    "nextCursor": "opaque-or-null"
  }
}
```

### Lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "fieldErrors": {
      "quantity": ["Số lượng phải lớn hơn 0."]
    },
    "details": {},
    "requestId": "req_123"
  }
}
```

`details` chỉ chứa allowlist, không chứa stack, SQL, token hoặc PII đầy đủ.

### HTTP status

| Status | Ý nghĩa |
|---:|---|
| 200 | Query/action thành công |
| 201 | Tạo resource |
| 204 | Xóa mềm/xóa cart item thành công |
| 400 | JSON/header/query malformed |
| 401 | Chưa authenticated |
| 403 | Authenticated nhưng thiếu quyền |
| 404 | Không tồn tại hoặc ngoài ownership/assignment scope |
| 409 | State, version, inventory, slot hoặc idempotency conflict |
| 422 | Semantic validation |
| 429 | Rate limited |
| 500 | Lỗi bất ngờ, response đã sanitize |

## 3. DTO chuẩn

### Money

```json
{ "amount": "1250000", "currency": "VND" }
```

### Address input

```json
{
  "recipientName": "Nguyen Van A",
  "phone": "0900000000",
  "line1": "123 Duong A",
  "line2": null,
  "wardCode": "optional-code",
  "wardName": "Phuong X",
  "districtCode": "optional-code",
  "districtName": "Quan Y",
  "provinceCode": "optional-code",
  "provinceName": "TP Ho Chi Minh",
  "postalCode": null,
  "countryCode": "VN",
  "isDefault": false
}
```

Giới hạn chiều dài và chuẩn hóa được Zod/server policy áp dụng. Client không gửi `userId` hoặc kết quả match vùng đáng tin cậy.

### Optimistic concurrency

Mutation aggregate gửi:

```json
{ "expectedVersion": 3 }
```

Thành công trả version mới. Sai version: `409 CONCURRENT_MODIFICATION`.

## 4. Endpoint catalog công khai

| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/products` | Public | Catalog active |
| GET | `/api/v1/products/{slug}` | Public | Chi tiết active |
| POST | `/api/v1/service-areas/check` | Public, rate limit | Kiểm tra vùng |
| GET | `/api/v1/installation-slots` | Public hoặc CUSTOMER | Slot sơ bộ theo area/date |

### `GET /products`

Query: `category`, `q`, `minPrice`, `maxPrice`, `cursor`, `limit`.

Response item chỉ gồm product active, variant active, ảnh public, giá server và availability không cam kết. Không trả inventory counters.

### `POST /service-areas/check`

Body gồm mã/tên địa lý từ Address input, không cần recipient/phone.

Response:

```json
{
  "data": {
    "status": "SUPPORTED",
    "serviceArea": {
      "id": "uuid",
      "code": "HCM-Q1",
      "name": "Quan 1"
    },
    "fees": {
      "installationFee": "200000",
      "shippingFee": "0",
      "currency": "VND"
    }
  },
  "meta": { "requestId": "req_123" }
}
```

`AMBIGUOUS` trả candidate tối thiểu; checkout luôn kiểm tra lại.

### `GET /installation-slots`

Query: `serviceAreaId`, `fromDate`, `toDate` tối đa khoảng thời gian được duyệt. Trả `slotId`, start/end và `available`; không cam kết giữ slot.

## 5. Identity và địa chỉ

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/v1/me` | Authenticated |
| GET | `/api/v1/addresses` | CUSTOMER own |
| POST | `/api/v1/addresses` | CUSTOMER own |
| PATCH | `/api/v1/addresses/{id}` | CUSTOMER own |
| DELETE | `/api/v1/addresses/{id}` | CUSTOMER own, soft archive |

Auth.js endpoints nằm dưới route chuẩn được cấu hình; không tái tạo login protocol tùy ý.

Address mutation:

- Server lấy owner từ session.
- Server normalize/match lại vùng.
- `DELETE` không sửa snapshot đơn cũ.
- Resource của user khác trả `404`.

## 6. Cart và quote

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/v1/cart` | CUSTOMER own |
| POST | `/api/v1/cart/items` | CUSTOMER own |
| PATCH | `/api/v1/cart/items/{id}` | CUSTOMER own |
| DELETE | `/api/v1/cart/items/{id}` | CUSTOMER own |
| POST | `/api/v1/checkout/quote` | CUSTOMER own |

Add item body:

```json
{
  "productVariantId": "uuid",
  "servicePackageId": "uuid-or-null",
  "quantity": 1
}
```

Update body: `{ "quantity": 2 }`.

Quote body:

```json
{
  "addressId": "uuid-or-null",
  "slotId": "uuid-or-null"
}
```

Quote response:

```json
{
  "data": {
    "items": [
      {
        "cartItemId": "uuid",
        "productVariantId": "uuid",
        "name": "Camera A",
        "quantity": 1,
        "deviceUnitPrice": "1000000",
        "serviceUnitPrice": "200000",
        "unitPrice": "1200000",
        "lineTotal": "1200000",
        "availability": "AVAILABLE"
      }
    ],
    "subtotal": "1200000",
    "installationFee": "0",
    "shippingFee": "0",
    "discountTotal": "0",
    "grandTotal": "1200000",
    "currency": "VND",
    "fingerprint": "opaque",
    "quotedAt": "2026-07-13T08:00:00Z"
  },
  "meta": { "requestId": "req_123" }
}
```

Quote không giữ hàng/slot. Client không được gửi `unitPrice` hoặc tổng có hiệu lực.

## 7. Checkout

### `POST /api/v1/orders`

Quyền: CUSTOMER. Header bắt buộc:

```text
Idempotency-Key: client-generated-opaque-key
```

Body:

```json
{
  "cartId": "uuid",
  "addressId": "uuid",
  "paymentMethod": "COD",
  "slotId": "uuid-or-null",
  "quoteFingerprint": "optional-opaque"
}
```

Server:

1. Xác minh session, ownership và CSRF/origin.
2. Parse header/body.
3. Tính lại giá từ DB.
4. Kiểm tra vùng, inventory và slot.
5. Reserve inventory, book slot, tạo order/items/payment/appointment trong transaction.
6. Không tin quote fingerprint thay cho tính lại.

Response `201`:

```json
{
  "data": {
    "id": "uuid",
    "orderNumber": "247H-...",
    "status": "PENDING_CONFIRMATION",
    "payment": {
      "method": "COD",
      "status": "PENDING",
      "amount": "1200000",
      "referenceCode": "PAY-..."
    },
    "grandTotal": "1200000",
    "currency": "VND",
    "version": 1
  },
  "meta": { "requestId": "req_123" }
}
```

Idempotency:

- Cùng user/key và canonical payload: trả order cũ (`200` hoặc replay `201` nhất quán, kèm `Idempotent-Replayed: true`).
- Cùng key, payload khác: `409 IDEMPOTENCY_KEY_REUSED`.
- Request đang xử lý: `409 IDEMPOTENCY_IN_PROGRESS` hoặc chờ hữu hạn; chọn một behavior khi implementation.
- Key có giới hạn chiều dài/format và retention được duyệt.

Conflict:

- `PRICE_CHANGED`
- `INVENTORY_INSUFFICIENT`
- `INVENTORY_CONFLICT`
- `SLOT_UNAVAILABLE`
- `SERVICE_AREA_UNSUPPORTED`
- `CART_NOT_ACTIVE`

Không có order/payment/appointment/allocation một phần khi transaction thất bại. Mỗi order item mới có đúng một inventory allocation `RESERVED`; appointment checkout có lắp đặt khởi tạo ở `ASSIGNMENT_PENDING`.

## 8. Customer order và installation

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/v1/orders` | CUSTOMER own |
| GET | `/api/v1/orders/{id}` | CUSTOMER own |
| POST | `/api/v1/orders/{id}/actions/cancel` (deferred) | CUSTOMER own + state policy |
| GET | `/api/v1/orders/{id}/installation` (deferred; current order detail embeds appointment) | CUSTOMER own |
| POST | `/api/v1/installation-appointments/{id}/actions/reschedule` (deferred) | CUSTOMER own + deadline/state |

Chỉ hai route GET đầu tiên được expose trong staging MVP đã freeze. Các action
customer còn lại là target contract tương lai và không được client giả định là
khả dụng.

Cancel body:

```json
{
  "reason": "Khong con nhu cau",
  "expectedVersion": 1
}
```

Reschedule body:

```json
{
  "newSlotId": "uuid",
  "reason": "Can doi gio",
  "expectedVersion": 2
}
```

Customer order DTO không trả internal note, full audit, staff-only metadata hoặc dữ liệu payment nhạy cảm. Sai owner trả `404`.

## 9. Warranty customer (planned, not exposed)

Các route trong mục này là target contract và chưa tồn tại trong implementation
hiện tại. Client không được giả định chúng khả dụng cho tới khi vertical slice
Warranty có authorization, eligibility, audit và test riêng.

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/v1/warranty-requests` | CUSTOMER own |
| POST | `/api/v1/warranty-requests` | CUSTOMER own order item |
| GET | `/api/v1/warranty-requests/{id}` | CUSTOMER own |

Create body:

```json
{
  "orderItemId": "uuid",
  "issueType": "DEVICE_NOT_WORKING",
  "description": "Mo ta toi da theo schema",
  "contactPhone": "0900000000"
}
```

Server kiểm ownership và eligibility. Response không chứa `internalNote`.

## 10. Admin catalog và inventory

Prefix `/api/v1/admin`.

| Method | Path | Quyền tối thiểu |
|---|---|---|
| GET/POST | `/products` | STAFF read/create; MANAGER/ADMIN |
| GET/PATCH | `/products/{id}` | STAFF theo permission; MANAGER/ADMIN |
| POST | `/products/{id}/actions/publish` | Permission catalog publish |
| POST | `/products/{id}/actions/archive` | Permission catalog archive |
| POST/PATCH | `/product-variants[/{id}]` | Permission catalog write |
| POST/PATCH | `/service-packages[/{id}]` | Permission catalog write |
| POST | `/inventory/{variantId}/actions/adjust` | Permission inventory adjust |
| GET | `/inventory` | STAFF/MANAGER/ADMIN theo policy |

Ví dụ adjust:

```json
{
  "mode": "DELTA",
  "quantity": 5,
  "reason": "Nhap kho PO-123",
  "expectedVersion": 4
}
```

Không cho `onHand < reserved`. Mutation và audit commit cùng transaction. Money admin là decimal string integer VND.

## 11. Admin service area và slot

Service-area routes dưới đây đã được triển khai với prefix `/api/v1`. Các route
installation-slot admin vẫn là target contract và chưa được expose.

| Method | Path | Quyền |
|---|---|---|
| GET/POST | `/api/v1/admin/service-areas` | MANAGER/ADMIN; STAFF read nếu cấp |
| PATCH/DELETE | `/api/v1/admin/service-areas/{id}` | MANAGER/ADMIN |
| GET/POST | `/api/v1/admin/installation-slots` (planned) | MANAGER/ADMIN |
| PATCH | `/api/v1/admin/installation-slots/{id}` (planned) | MANAGER/ADMIN |

Capacity không giảm dưới `bookedCount`. Mọi mutation yêu cầu `expectedVersion`, reason với action nhạy cảm và audit.

## 12. Admin order/payment

| Method | Path | Quyền |
|---|---|---|
| GET | `/admin/orders` | STAFF/MANAGER/ADMIN |
| GET | `/admin/orders/{id}` | STAFF/MANAGER/ADMIN |
| POST | `/api/v1/admin/orders/{id}/actions` | STAFF/MANAGER/ADMIN theo server policy của action |
| GET | `/api/v1/admin/payments/{id}/actions` | STAFF/MANAGER/ADMIN; only policy-allowed actions |
| POST | `/api/v1/admin/payments/{id}/actions` | STAFF/MANAGER/ADMIN; payment policy |

Order actions:

- `confirm`
- `start-processing`
- `mark-ready-for-installation`
- `mark-installation-in-progress` chủ yếu do appointment orchestration
- `complete`
- `cancel`

Body chung:

```json
{
  "action": "mark-ready-for-installation",
  "expectedVersion": 3,
  "reason": "Bat buoc voi action nhay cam"
}
```

Không có `PATCH status`. Route không tự định nghĩa transition; action, actor, current state, next state, payment guard và inventory guard đều do policy server-side duy nhất quyết định. Mutation dùng conditional write theo `id + expectedVersion + expected current status`; count khác `1` trả `409 CONCURRENT_MODIFICATION`.

`mark-ready-for-installation` chuyển reservation `RESERVED -> CONSUMED`, giảm `inventory.onHand` và `inventory.reserved`, cập nhật order/version và ghi audit trong cùng transaction. Request retry bằng version cũ trả `409` và không consume/audit lần hai. `complete-without-installation` yêu cầu payment `PAID`, inventory `CONSUMED` và không có appointment.

Response thành công chỉ trả DTO JSON-safe gồm `id`, `status`, `inventoryStatus`, `version` và các timestamp transition liên quan; không trả trực tiếp Prisma money `BigInt` hoặc payload order đầy đủ.

Các conflict liên quan:

- `409 CONCURRENT_MODIFICATION`: version cũ hoặc conditional write không còn khớp.
- `409 INVALID_STATE_TRANSITION`: action/current status hoặc payment guard không hợp lệ.
- `409 INVENTORY_CONFLICT`: thiếu reservation hoặc inventory lifecycle không hợp lệ; transaction không commit một phần.

Payment action:

```json
{
  "action": "CONFIRM_PAYMENT",
  "expectedVersion": 1,
  "reference": "BANK-REF-...",
  "reason": "Da doi soat"
}
```

`CONFIRM_PAYMENT` and `REJECT_PAYMENT` are valid only from `PENDING`. A stale
version or conditional-write mismatch returns `409 CONCURRENT_MODIFICATION` or
`409 INVALID_STATE_TRANSITION` and does not write a duplicate audit event.

Không nhận/sửa amount từ client.

## 13. Technician và appointment

### Admin

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/v1/admin/operations/orders?status=&cursor=&limit=` | STAFF/MANAGER/ADMIN |
| GET | `/api/v1/admin/operations/orders/{id}` | STAFF/MANAGER/ADMIN |
| GET | `/api/v1/admin/orders/{id}/actions` | STAFF/MANAGER/ADMIN; returns only policy-allowed actions |
| POST | `/api/v1/admin/orders/{id}/actions` | STAFF/MANAGER/ADMIN; server validates action and version |
| GET | `/api/v1/admin/operations/appointments?status=&cursor=&limit=` | STAFF/MANAGER/ADMIN |
| GET | `/api/v1/admin/operations/technicians?appointmentId={id}&cursor=&limit=&search=` | MANAGER/ADMIN |
| POST | `/api/v1/admin/operations/appointments/{id}/assign` | MANAGER/ADMIN |
| POST | `/api/v1/admin/operations/appointments/{id}/reschedule` | MANAGER/ADMIN |

Assign body:

```json
{
  "technicianId": "uuid",
  "expectedVersion": 2,
  "reason": "Phan cong ca sang"
}
```

Server kiểm active, vùng phục vụ và overlap trong transaction. PostgreSQL exclusion constraint là guard cuối khi hai request phân công chạy đồng thời.

Các list order, appointment, warranty, audit và candidate technician dùng cursor ổn định với `id` làm tie-breaker. `limit` mặc định 25, tối đa 100. Candidate technician có thể lọc `search` theo tên, nhưng server vẫn kiểm service area, active state và overlap schedule trước khi trả dữ liệu. Response list có dạng `data: { items, nextCursor }`; assignment dialog tải thêm trang khi có `nextCursor`. UI chỉ hiển thị action do endpoint policy trả về và server kiểm tra lại action cùng `expectedVersion` khi mutation.

### Technician workspace

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/v1/technician/assignments?status=&cursor=&limit=` | TECHNICIAN own active/completed assignments |
| GET | `/api/v1/technician/assignments/{id}` | TECHNICIAN assigned |
| GET | `/api/v1/technician/assignments/{id}/actions` | TECHNICIAN assigned; returns only policy-allowed action intents |
| POST | `/api/v1/technician/assignments/{id}/actions` | TECHNICIAN assigned + state |
| POST | `/api/v1/technician/assignments/{id}/evidence` | TECHNICIAN assigned |
| GET | `/api/v1/operations/evidence/{id}` | Owner TECHNICIAN hoặc STAFF/MANAGER/ADMIN |

Actions: `accept`, `en-route`, `arrive`, `start`, `complete`. `accept` chỉ ghi `acceptedAt`, không tạo state riêng.

Body:

```json
{
  "action": "arrive",
  "expectedVersion": 2,
  "note": "optional bounded plain text"
}
```

DTO chỉ chứa địa chỉ/contact tối thiểu cần thi công, không chứa payment/internal admin data. Assignment người khác trả `404`.
Evidence local chỉ hoạt động ở development/test, kiểm MIME/extension/signature/kích thước, dùng tên server-side và preview không lộ filesystem path.

## 14. Admin warranty và audit

| Method | Path | Quyền |
|---|---|---|
| GET | `/api/v1/admin/operations/warranties?status=&cursor=&limit=` | STAFF/MANAGER/ADMIN |
| GET | `/api/v1/admin/operations/warranties/{id}` | STAFF/MANAGER/ADMIN |
| GET | `/api/v1/admin/operations/audit?action=&targetType=&targetId=&cursor=&limit=` | MANAGER/ADMIN |

Warranty actions chưa được expose trong Operations UI hiện tại; giao diện chỉ hiển thị chi tiết và không hiển thị action khi server policy/endpoint chưa tồn tại.

Body dự kiến cho warranty mutation tương lai:

```json
{
  "expectedVersion": 2,
  "reason": "Ly do nghiep vu",
  "publicResolution": "optional customer-visible",
  "internalNote": "optional staff-only"
}
```

Audit query: `action`, `targetType`, `targetId`, `cursor`, `limit`. Không có mutation audit endpoint. Payload luôn redact.

## 15. Admin role (planned, not exposed)

Các route role-management trong mục này chưa tồn tại trong implementation hiện
tại. Server vẫn đọc role để authorize, nhưng không có mutation tự nâng quyền.

| Method | Path | Quyền |
|---|---|---|
| GET | `/admin/users` | ADMIN; MANAGER read hạn chế nếu duyệt |
| GET | `/admin/users/{id}/roles` | ADMIN |
| POST | `/admin/users/{id}/roles` | ADMIN |
| DELETE | `/admin/users/{id}/roles/{roleCode}` | ADMIN |

Gán role body:

```json
{
  "role": "STAFF",
  "reason": "Bo nhiem van hanh"
}
```

Không cho xóa ADMIN cuối cùng. Mutation tăng `authVersion`, có audit; session stale phải được xử lý theo chiến lược Auth.js.

## 16. Health

| Method | Path | Auth | Nội dung |
|---|---|---|---|
| GET | `/api/health` | Local/test policy | Process alive |
| GET | `/api/ready` | Local/test policy | DB reachable với timeout |

Không trả config, dependency version, hostname nhạy cảm hoặc credential.

## 17. Error codes chuẩn

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `METHOD_NOT_ALLOWED`
- `UNSUPPORTED_MEDIA_TYPE`
- `PAYLOAD_TOO_LARGE`
- `RATE_LIMITED`
- `PRICE_CHANGED`
- `INVENTORY_INSUFFICIENT`
- `PACKAGE_NOT_COMPATIBLE`
- `SERVICE_AREA_UNSUPPORTED`
- `SLOT_UNAVAILABLE`
- `TECHNICIAN_SCHEDULE_CONFLICT`
- `INVALID_STATE_TRANSITION`
- `CONCURRENT_MODIFICATION`
- `IDEMPOTENCY_KEY_REQUIRED`
- `IDEMPOTENCY_KEY_REUSED`
- `IDEMPOTENCY_IN_PROGRESS`
- `CART_NOT_ACTIVE`
- `WARRANTY_NOT_ELIGIBLE`
- `LAST_ADMIN_PROTECTED`
- `INTERNAL_ERROR`

Không dùng message để client quyết định logic; dùng `code`.

## 18. Security và cache contract

- Cookie-based sensitive mutations dùng shared server wrapper cho auth/reset,
  cart, checkout, catalog/inventory admin, payment và Operations. Wrapper kiểm
  allowed Origin, Content-Type, body size và scoped rate limit trước use case.
- Rate limiter có interface thay thế được; local/test dùng in-memory adapter.
  Staging/production nhiều instance phải cấu hình shared adapter trước rollout.
- HTTP logger chỉ ghi allowlist gồm request ID, method, route không có query,
  status và duration; không ghi body, token, secret hoặc PII.

- Response auth-sensitive: `Cache-Control: private, no-store`.
- Catalog public có thể cache server-side; không cache availability làm cam kết.
- Operations mutation kiểm `Origin` theo `NEXTAUTH_URL`/`APP_ORIGIN`; development/test chỉ allow `http://localhost:3000` và `http://127.0.0.1:3000`.
- Operations mutation chỉ nhận `application/json`. Body JSON action mặc định tối đa 64 KiB; endpoint evidence local dùng JSON base64 tối đa 8 MiB theo schema upload hiện tại.
- Operations mutation rate-limit 30 request/phút theo client và action scope. Chỉ đọc `X-Forwarded-For`/`X-Real-IP` khi `TRUST_PROXY_HEADERS=true` và ingress đã được cấu hình xóa header do client tự gửi; mặc định fail-closed dùng một bucket không tin cậy. Lỗi trả envelope chuẩn: `403 FORBIDDEN`, `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED` kèm `Retry-After`.
- Rate limit auth, service check, checkout, warranty và action admin nhạy cảm.
- `requestId` nhận từ proxy chỉ khi trusted; nếu không server sinh mới.
- Không phản chiếu raw input trong lỗi.
- Không log body checkout/address/warranty.
- Resource ngoài scope ưu tiên `404`.
- Endpoint admin không chỉ dựa vào route prefix; use case kiểm quyền.

## 19. Contract tests bắt buộc

- Zod reject trường/enum/ID/money không hợp lệ.
- Mọi protected endpoint trả `401` khi anonymous.
- Ma trận role trả `403` đúng action.
- Ownership/assignment sai trả `404`.
- Client gửi field giá/tổng bị reject hoặc bỏ qua có chủ đích; tổng DB vẫn từ server.
- Idempotency behavior đủ ba nhánh.
- Expected version stale trả `409`.
- State action không hợp lệ trả `409`.
- Response customer không chứa internal fields.
- Audit endpoint không có update/delete.
- Error không lộ stack/SQL/PII.
- Money luôn trả string.
