# 247 Home — Database Design

## 1. Mục tiêu

Thiết kế PostgreSQL cho MVP phải:

- Giữ toàn vẹn giá, tồn kho, đơn hàng và slot dưới concurrent requests.
- Hỗ trợ RBAC cộng ownership/assignment.
- Lưu snapshot nghiệp vụ để lịch sử không đổi theo catalog.
- Cho phép audit append-only tại tầng ứng dụng.
- Tương thích Prisma; dùng migration SQL có kiểm soát cho constraint/locking đặc thù PostgreSQL.
- Không lưu dữ liệu thẻ, password thô, token thô hoặc secret.
- Hỗ trợ một kho logic, một currency (`VND`) và tối đa một appointment hiệu lực/order trong MVP.

Tên vật lý dùng `snake_case`. ID ví dụ dùng UUID. Quyết định UUID v4/v7 hoặc CUID2 cần chốt trước migration đầu tiên; mọi bảng phải dùng thống nhất.

## 2. Quy ước dữ liệu

### 2.1 Kiểu chung

| Khái niệm | Kiểu PostgreSQL | Quy tắc |
|---|---|---|
| ID | `uuid` | Sinh server-side; không mang ý nghĩa nghiệp vụ |
| Money | `bigint` | Số nguyên VND, `>= 0`; API trả decimal string |
| Quantity | `integer` | `> 0` hoặc `>= 0` tùy trường |
| Timestamp | `timestamptz` | Lưu UTC |
| Local service date | `date` | Diễn giải theo `Asia/Ho_Chi_Minh` |
| Time of day | `time` | Dùng cùng service date/timezone |
| Enum | PostgreSQL enum hoặc text + check | Chọn nhất quán trong migration |
| Flexible metadata | `jsonb` | Chỉ khi schema ổn định không phù hợp cột; vẫn validation server |
| Version | `integer` | Bắt đầu `1`, tăng mỗi mutation |
| Soft lifecycle | `status`, `archived_at` | Không hard-delete bản ghi đã được tham chiếu |

### 2.2 Cột chuẩn

Tùy bảng:

- `id`
- `created_at`
- `updated_at`
- `version` với aggregate mutable
- `created_by_user_id`, `updated_by_user_id` chỉ khi audit/reference cần thiết

`updated_at` do application hoặc DB trigger được chọn thống nhất; audit không dựa riêng vào `updated_at`.

### 2.3 Quy tắc xóa

- `RESTRICT` cho dữ liệu lịch sử và tài chính.
- `CASCADE` chỉ với child không có ý nghĩa độc lập, ví dụ item của cart chưa checkout.
- User/product/variant/order/payment/appointment không hard-delete qua API.
- Yêu cầu xóa dữ liệu cá nhân cần policy anonymization riêng; chưa nằm trong MVP.
- Audit log không có mutation delete/update trong ứng dụng.

## 3. Enum đề xuất

```text
role_code:
  CUSTOMER | STAFF | TECHNICIAN | MANAGER | ADMIN

user_status:
  ACTIVE | SUSPENDED | DISABLED

product_status:
  DRAFT | ACTIVE | ARCHIVED

variant_status:
  DRAFT | ACTIVE | ARCHIVED

service_package_status:
  DRAFT | ACTIVE | ARCHIVED

cart_status:
  ACTIVE | CHECKED_OUT | ABANDONED

order_status:
  PENDING_CONFIRMATION | CONFIRMED | PROCESSING
  | READY_FOR_INSTALLATION | INSTALLATION_IN_PROGRESS
  | COMPLETED | CANCELLED

payment_method:
  COD | BANK_TRANSFER

payment_status:
  PENDING | PAID | FAILED | CANCELLED

appointment_status:
  SCHEDULED | ASSIGNMENT_PENDING | ASSIGNED | EN_ROUTE
  | ARRIVED | IN_PROGRESS | COMPLETED | CANCELLED
  | RESCHEDULE_REQUIRED

PostgreSQL vẫn giữ giá trị enum legacy `CONFIRMED` để migration additive an toàn. Migration backfill row cũ về `ASSIGNED`; application policy không tạo `CONFIRMED`, và dùng `accepted_at` làm dấu thời gian xác nhận.

assignment_status:
  ACTIVE | COMPLETED | CANCELLED

warranty_status:
  SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED
  | IN_SERVICE | RESOLVED | CLOSED

inventory_disposition:
  RESERVED | CONSUMED | RELEASED

service_match_status (response only):
  SUPPORTED | UNSUPPORTED | AMBIGUOUS
```

State machine là nguồn chuẩn tại hai tài liệu state machine. Không cho update enum trực tiếp ngoài action use case.

## 4. ERD logic

```text
users --< user_roles >-- roles
users --< addresses
users --< carts --< cart_items >-- product_variants >-- products
                                   |
                                   +--> service_packages

products --< product_images
products --< product_variants --1 inventory
product_variants --< service_packages

users --< orders --< order_items
orders --< payments
orders --0..1 installation_appointments >-- service_areas
installation_appointments --< technician_assignments >-- technicians --1 users
order_items --< warranty_requests
users --< warranty_requests

service_areas --< installation_slots --< installation_appointments

users --< audit_logs
```

`installation_slots` và `inventory_allocations` là bảng hỗ trợ được đề xuất ngoài danh sách tối thiểu. Chúng cần thiết để khóa capacity và bảo đảm release/consume đúng một lần.

## 5. Bảng bắt buộc

### 5.1 `users`

Identity nội bộ của mọi actor.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `email` | text | yes | Email chuẩn hóa; nullable nếu provider khác |
| `email_normalized` | text | yes | Lowercase/canonical để unique |
| `name` | text | yes | Tối đa theo schema |
| `phone` | text | yes | PII; định dạng chuẩn hóa |
| `status` | user_status | no | Default `ACTIVE` |
| `auth_version` | integer | no | Default 1; invalidate session/role cache nếu cần |
| `email_verified_at` | timestamptz | yes | Theo Auth.js/provider |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

Constraint/index:

- PK `id`.
- Partial unique `email_normalized WHERE email_normalized IS NOT NULL`.
- Check `auth_version > 0`.
- Index `(status)`.
- Auth.js có thể yêu cầu `accounts`, `sessions`, `verification_tokens`; bổ sung theo adapter chính thức trong migration identity, không gộp token vào `users`.
- Không lưu password thô. Nếu Credentials được duyệt, hash nằm cột/bảng credential riêng, không bao giờ log.

### 5.2 `roles`

Danh mục role hệ thống.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `code` | role_code | no | Unique |
| `name` | text | no | Tên hiển thị |
| `description` | text | yes | |
| `is_system` | boolean | no | Default true |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

Seed đúng năm role cố định. Không cho xóa role hệ thống.

### 5.3 `user_roles`

Quan hệ nhiều-nhiều user-role.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `user_id` | uuid | no | FK users |
| `role_id` | uuid | no | FK roles |
| `assigned_by_user_id` | uuid | yes | FK users; null cho bootstrap |
| `assigned_at` | timestamptz | no | |
| `reason` | text | yes | Bắt buộc cho admin mutation |

Constraint/index:

- PK `(user_id, role_id)`.
- Index `(role_id, user_id)`.
- `ON DELETE RESTRICT`.
- Rule “không xóa ADMIN cuối cùng” cần transaction lock/policy; DB trigger tùy review.
- Gán/gỡ luôn tăng `users.auth_version` và tạo audit trong cùng transaction.

### 5.4 `addresses`

Địa chỉ do customer quản lý. Đơn lưu snapshot riêng, không phụ thuộc thay đổi sau đó.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | Owner |
| `recipient_name` | text | no | PII |
| `phone` | text | no | PII |
| `line1` | text | no | PII |
| `line2` | text | yes | PII |
| `ward_code` | text | yes | Mã chuẩn hóa |
| `ward_name` | text | no | |
| `district_code` | text | yes | |
| `district_name` | text | no | |
| `province_code` | text | yes | |
| `province_name` | text | no | |
| `postal_code` | text | yes | |
| `country_code` | char(2) | no | Default `VN` |
| `service_area_id` | uuid | yes | Kết quả match gần nhất, không phải cam kết vĩnh viễn |
| `is_default` | boolean | no | |
| `archived_at` | timestamptz | yes | Soft delete |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

Index/constraint:

- Index `(user_id, archived_at)`.
- Partial unique một default active/user: `(user_id) WHERE is_default AND archived_at IS NULL`.
- FK `service_area_id` dùng `ON DELETE SET NULL`; checkout match lại.
- Tất cả query customer scope bằng `user_id`.

### 5.5 `service_areas`

Khu vực có hỗ trợ lắp đặt.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `code` | text | no | Mã nghiệp vụ unique |
| `name` | text | no | |
| `province_code` | text | no | |
| `district_code` | text | yes | Null nghĩa phạm vi rộng hơn |
| `ward_code` | text | yes | |
| `priority` | integer | no | Resolve match cụ thể |
| `is_active` | boolean | no | |
| `installation_fee` | bigint | no | VND, server pricing |
| `shipping_fee` | bigint | no | VND |
| `timezone` | text | no | Default `Asia/Ho_Chi_Minh` |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique `code`.
- Check fees `>= 0`, `priority >= 0`, `version > 0`.
- Unique/overlap policy trên mã địa lý cần migration cụ thể; không cho hai active record cùng tuple và priority.
- Index `(is_active, province_code, district_code, ward_code)`.
- Không hard-delete khi được appointment/address tham chiếu.

### 5.6 `products`

Sản phẩm cha dùng hiển thị/catalog.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `slug` | text | no | Unique, public URL |
| `name` | text | no | |
| `category` | text/enum | no | Camera, doorbell, mesh, lock |
| `short_description` | text | yes | |
| `description` | text | yes | Không lưu HTML không tin cậy |
| `status` | product_status | no | |
| `requires_installation` | boolean | no | |
| `published_at` | timestamptz | yes | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique normalized `slug`.
- Index `(status, category, published_at)`.
- Active product phải có publish action; invariant variant active kiểm tra tại application transaction.
- Archive thay vì delete.

### 5.7 `product_variants`

SKU bán được và nguồn giá thiết bị.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `product_id` | uuid | no | FK |
| `sku` | text | no | Unique, normalized |
| `name` | text | no | Ví dụ màu/dung lượng |
| `attributes` | jsonb | no | Object allowlist theo category |
| `price` | bigint | no | VND |
| `status` | variant_status | no | |
| `warranty_months` | integer | no | Chính sách tại thời điểm bán được snapshot |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique `sku`.
- Check `price >= 0`, `warranty_months >= 0`, `version > 0`.
- GIN cho `attributes` chỉ thêm khi query thực tế cần.
- Index `(product_id, status)`.
- Không delete variant đã có order item.

### 5.8 `product_images`

Metadata ảnh sản phẩm.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `product_id` | uuid | no | FK |
| `variant_id` | uuid | yes | Ảnh riêng variant |
| `url` | text | no | Chỉ scheme/domain được duyệt |
| `alt_text` | text | no | Accessibility |
| `sort_order` | integer | no | |
| `is_primary` | boolean | no | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

Constraint/index:

- Check `sort_order >= 0`.
- Index `(product_id, sort_order)`.
- Partial unique primary cho product/variant cần xử lý null rõ ràng.
- MVP chỉ lưu URL metadata; upload/storage nằm ngoài phạm vi.

### 5.9 `inventory`

Số lượng cấp variant trong một kho logic.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `product_variant_id` | uuid | no | FK, unique |
| `on_hand` | integer | no | Tổng vật lý |
| `reserved` | integer | no | Đã giữ cho order |
| `version` | integer | no | Optimistic concurrency |
| `updated_at` | timestamptz | no | |

Constraint/index:

- Unique `product_variant_id`.
- Check `on_hand >= 0`.
- Check `reserved >= 0`.
- Check `reserved <= on_hand`.
- Check `version > 0`.
- Row được khóa `FOR UPDATE` khi reserve/release/consume/adjust.
- Không dùng `available` lưu dư thừa; tính `on_hand - reserved`.

### 5.10 `service_packages`

Gói công lắp đặt/combo dịch vụ tương thích với variant trong baseline MVP.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `code` | text | no | Unique |
| `name` | text | no | |
| `description` | text | yes | |
| `product_variant_id` | uuid | yes | Null nếu package dùng chung; policy compatibility cần rõ |
| `price` | bigint | no | Phần giá dịch vụ/package |
| `estimated_duration_minutes` | integer | no | |
| `requires_installation` | boolean | no | Thường true |
| `status` | service_package_status | no | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique `code`.
- Check `price >= 0`, duration `> 0`, version `> 0`.
- Index `(product_variant_id, status)`.
- Nếu cần package tương thích nhiều variant, bổ sung join table `service_package_variants`; không nhét danh sách ID vào JSON.
- Nếu combo chứa nhiều SKU tồn kho, cần `service_package_components` và ADR mới trước implementation.

### 5.11 `carts`

Giỏ gắn user trong MVP.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | Owner |
| `status` | cart_status | no | |
| `currency` | char(3) | no | `VND` |
| `checked_out_order_id` | uuid | yes | Set sau checkout |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Partial unique `(user_id) WHERE status = 'ACTIVE'`.
- Check currency `VND`, version > 0.
- `checked_out_order_id` unique nullable.
- Checkout lock cart; cart không giữ tồn kho.

### 5.12 `cart_items`

Dòng giỏ tham chiếu dữ liệu sống, không lưu tổng đáng tin cậy.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `cart_id` | uuid | no | FK |
| `product_variant_id` | uuid | no | FK |
| `service_package_id` | uuid | yes | FK |
| `quantity` | integer | no | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

Constraint/index:

- Check `quantity > 0` và giới hạn server.
- Unique `(cart_id, product_variant_id, service_package_id)` cần xử lý null bằng `NULLS NOT DISTINCT` trên PostgreSQL 15+ hoặc unique expression index.
- Index `(cart_id)`.
- Không có `unit_price`/`line_total` làm source of truth.
- FK child cart có thể cascade khi cart test chưa có lịch sử; production policy ưu tiên giữ checked-out cart.

### 5.13 `orders`

Aggregate đơn hàng và snapshot địa chỉ/tổng.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `order_number` | text | no | Unique, không dùng làm secret |
| `user_id` | uuid | no | Customer |
| `status` | order_status | no | |
| `currency` | char(3) | no | `VND` |
| `subtotal` | bigint | no | |
| `installation_fee` | bigint | no | |
| `shipping_fee` | bigint | no | |
| `discount_total` | bigint | no | 0 trong MVP |
| `grand_total` | bigint | no | |
| `recipient_name` | text | no | Snapshot PII |
| `recipient_phone` | text | no | Snapshot PII |
| `address_line1` | text | no | Snapshot |
| `address_line2` | text | yes | Snapshot |
| `ward_code`, `ward_name` | text | mixed | Snapshot |
| `district_code`, `district_name` | text | mixed | Snapshot |
| `province_code`, `province_name` | text | mixed | Snapshot |
| `postal_code` | text | yes | Snapshot |
| `country_code` | char(2) | no | Snapshot |
| `service_area_id` | uuid | yes | Area tại checkout |
| `idempotency_key` | text | no | Unique theo customer |
| `request_fingerprint` | text | no | Hash canonical payload, không chứa secret |
| `inventory_status` | inventory_disposition | no | Baseline `RESERVED` |
| `cancellation_reason` | text | yes | |
| `confirmed_at` | timestamptz | yes | |
| `completed_at` | timestamptz | yes | |
| `cancelled_at` | timestamptz | yes | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique `order_number`.
- Unique `(user_id, idempotency_key)`.
- Check mọi money `>= 0`.
- Check `grand_total = subtotal + installation_fee + shipping_fee - discount_total`.
- Check currency `VND`, version > 0.
- Index `(user_id, created_at DESC)`, `(status, created_at)`.
- Không update money/address/item snapshot sau insert qua use case thông thường.
- `inventory_status` chỉ chuyển `RESERVED -> CONSUMED` hoặc `RESERVED -> RELEASED`, ngăn side effect lặp.
- `idempotency_key` nên lưu hash nếu key có entropy nhạy cảm; giới hạn chiều dài.

### 5.14 `order_items`

Snapshot item tại checkout.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `order_id` | uuid | no | FK |
| `product_variant_id` | uuid | no | Reference lịch sử, không dùng để dựng giá cũ |
| `service_package_id` | uuid | yes | |
| `product_name` | text | no | Snapshot |
| `variant_name` | text | no | Snapshot |
| `sku` | text | no | Snapshot |
| `service_package_name` | text | yes | Snapshot |
| `quantity` | integer | no | |
| `device_unit_price` | bigint | no | Snapshot |
| `service_unit_price` | bigint | no | Snapshot |
| `unit_price` | bigint | no | Tổng đơn vị |
| `line_total` | bigint | no | |
| `warranty_months` | integer | no | Snapshot |
| `created_at` | timestamptz | no | |

Constraint/index:

- Check quantity > 0; money >= 0; warranty >= 0.
- Check `unit_price = device_unit_price + service_unit_price`.
- Check `line_total = unit_price * quantity`.
- Index `(order_id)`, `(product_variant_id)`.
- Không update/delete sau order creation.

### 5.15 `payments`

Ghi nhận COD hoặc chuyển khoản thủ công; không chứa thẻ.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `order_id` | uuid | no | FK |
| `method` | payment_method | no | |
| `status` | payment_status | no | |
| `amount` | bigint | no | Bằng grand total trong MVP |
| `currency` | char(3) | no | `VND` |
| `reference_code` | text | no | Mã chuyển khoản/thu tiền nội bộ |
| `external_reference` | text | yes | Mã giao dịch ngân hàng do staff nhập; không phải dữ liệu thẻ |
| `confirmed_by_user_id` | uuid | yes | |
| `confirmed_at` | timestamptz | yes | |
| `failure_reason` | text | yes | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Baseline unique `order_id` vì một payment/order trong MVP.
- Unique `reference_code`.
- Check amount >= 0, currency `VND`, version > 0.
- Không lưu PAN, CVV, expiry, bank credential hoặc ảnh chứng từ trong MVP.
- Payment state update là action có audit.

### 5.16 `installation_appointments`

Lịch lắp đặt gắn order và slot capacity.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `order_id` | uuid | no | FK, unique baseline |
| `service_area_id` | uuid | no | FK |
| `installation_slot_id` | uuid | no | FK bảng hỗ trợ |
| `status` | appointment_status | no | |
| `scheduled_start_at` | timestamptz | no | Snapshot từ slot |
| `scheduled_end_at` | timestamptz | no | |
| `customer_note` | text | yes | Không chứa secret |
| `internal_note` | text | yes | Không trả customer |
| `capacity_released_at` | timestamptz | yes | Ngăn release lặp |
| `completed_at` | timestamptz | yes | |
| `cancelled_at` | timestamptz | yes | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique `order_id` trong baseline.
- Check end > start, version > 0.
- Index `(service_area_id, scheduled_start_at, status)`.
- Index `(installation_slot_id, status)`.
- `capacity_released_at` null khi booking còn chiếm capacity.
- Reschedule cập nhật slot/timestamps dưới transaction và tăng version.

### 5.17 `technicians`

Hồ sơ kỹ thuật viên liên kết user có role TECHNICIAN.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | Unique FK users |
| `employee_code` | text | no | Unique |
| `status` | text/enum | no | `ACTIVE`, `INACTIVE`, `ON_LEAVE` |
| `skills` | jsonb | no | Allowlist category/certification |
| `service_area_ids` | không dùng | — | Dùng join table nếu cần nhiều vùng |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique `user_id`, `employee_code`.
- Check version > 0.
- Đề xuất `technician_service_areas(technician_id, service_area_id)` thay JSON cho vùng.
- Deactivate không tự hủy assignment; use case phải yêu cầu xử lý lịch mở.

### 5.18 `technician_assignments`

Quan hệ lịch-kỹ thuật viên và vòng đời phân công.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `installation_appointment_id` | uuid | no | FK |
| `technician_id` | uuid | no | FK |
| `status` | assignment_status | no | |
| `assigned_by_user_id` | uuid | no | FK users |
| `assigned_at` | timestamptz | no | |
| `accepted_at` | timestamptz | yes | |
| `completed_at` | timestamptz | yes | |
| `cancelled_at` | timestamptz | yes | |
| `scheduled_range` | tstzrange | no | Snapshot range cho exclusion |
| `version` | integer | no | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

Constraint/index:

- Partial unique một active assignment/appointment theo status mở.
- PostgreSQL exclusion constraint:
  - `EXCLUDE USING gist (technician_id WITH =, scheduled_range WITH &&)`
  - áp dụng `WHERE status IN ('ASSIGNED','ACCEPTED','ACTIVE')`.
- Cần extension `btree_gist`; migration phải ghi rõ.
- Check range không rỗng, version > 0.
- Lịch sử assignment cũ giữ `CANCELLED`; không overwrite technician.

### 5.19 `warranty_requests`

Yêu cầu bảo hành cho order item thuộc customer.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `request_number` | text | no | Unique |
| `order_item_id` | uuid | no | FK |
| `customer_user_id` | uuid | no | Owner, denormalized để scope hiệu quả |
| `status` | warranty_status | no | |
| `issue_type` | text/enum | no | Allowlist |
| `description` | text | no | Plain text, length limit |
| `contact_phone` | text | no | PII |
| `public_resolution` | text | yes | Customer xem được |
| `internal_note` | text | yes | Chỉ vận hành |
| `assigned_staff_user_id` | uuid | yes | |
| `submitted_at` | timestamptz | no | |
| `resolved_at` | timestamptz | yes | |
| `closed_at` | timestamptz | yes | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |
| `version` | integer | no | |

Constraint/index:

- Unique `request_number`.
- Index `(customer_user_id, created_at DESC)`.
- Index `(status, created_at)`.
- Check version > 0.
- Server xác minh `order_items -> orders.user_id = customer_user_id`.
- Eligibility dùng `order.completed_at + warranty_months`; policy ngày chính xác cần duyệt.
- Giới hạn một request mở/order item nếu policy yêu cầu bằng partial unique index.

### 5.20 `audit_logs`

Audit quản trị append-only tại tầng application.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `occurred_at` | timestamptz | no | |
| `actor_user_id` | uuid | yes | Null chỉ cho system/bootstrap event |
| `actor_roles` | text[]/jsonb | no | Snapshot role |
| `action` | text | no | Tên có namespace |
| `target_type` | text | no | |
| `target_id` | text | no | ID stringify |
| `request_id` | text | no | Correlation |
| `reason` | text | yes | Bắt buộc theo action |
| `before_data` | jsonb | yes | Allowlist/redact |
| `after_data` | jsonb | yes | Allowlist/redact |
| `metadata` | jsonb | no | Không chứa payload thô |
| `created_at` | timestamptz | no | Bằng/ gần occurred_at |

Constraint/index:

- Index `(occurred_at DESC)`.
- Index `(actor_user_id, occurred_at DESC)`.
- Index `(target_type, target_id, occurred_at DESC)`.
- Index `(action, occurred_at DESC)`.
- Không FK cứng target polymorphic.
- FK actor có `ON DELETE SET NULL` nếu anonymization tương lai; actor snapshot vẫn giữ.
- Application DB role không có UPDATE/DELETE trên bảng nếu mô hình quyền DB cho phép.
- Audit insert cùng transaction admin mutation.
- Không lưu password, token, cookie, full address, full phone, bank credential hoặc card data.

## 6. Bảng hỗ trợ khuyến nghị

### 6.1 `installation_slots`

Nguồn capacity có row cụ thể để khóa.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | uuid | no | PK |
| `service_area_id` | uuid | no | |
| `service_date` | date | no | Local date |
| `start_time` | time | no | Local |
| `end_time` | time | no | Local |
| `starts_at` | timestamptz | no | UTC resolved |
| `ends_at` | timestamptz | no | UTC resolved |
| `capacity` | integer | no | |
| `booked_count` | integer | no | Counter dưới lock |
| `is_active` | boolean | no | |
| `version` | integer | no | |
| `created_at`, `updated_at` | timestamptz | no | |

Constraint:

- Unique `(service_area_id, starts_at, ends_at)`.
- Check `ends_at > starts_at`.
- Check `capacity >= 0`, `booked_count >= 0`, `booked_count <= capacity`.
- Booking/reschedule/cancel lock row.
- Counter được đối soát định kỳ/test với appointment active; không sửa tay.

### 6.2 `inventory_allocations`

Ledger per order item để reserve/release/consume đúng một lần và truy vết.

| Cột | Kiểu | Null | Ghi chú |
|---|---|---:|---|
| `id` | text/CUID | no | PK |
| `order_item_id` | text/CUID | no | Unique |
| `product_variant_id` | text/CUID | no | FK tới variant/inventory owner |
| `quantity` | integer | no | |
| `status` | inventory_disposition | no | |
| `reserved_at` | timestamptz | no | |
| `released_at` | timestamptz | yes | |
| `consumed_at` | timestamptz | yes | |

Constraint:

- Unique `order_item_id`.
- Check quantity > 0.
- Status/timestamp consistency bằng check hoặc application + integration test.
- Aggregate order `inventory_status` phải nhất quán với allocations. Ledger là ownership source cho consume/release; counter `inventory.reserved` vẫn là aggregate được khóa để kiểm availability.
- Migration `20260715100000_inventory_allocation_integrity` chỉ backfill `RESERVED` khi tổng lịch sử đối soát chính xác với counter. Dòng lịch sử mơ hồ không bị tự sửa và bị application chặn transition cho tới khi có forward-fix được audit.

### 6.3 Các bảng tùy quyết định

- `service_package_variants`: package tương thích nhiều variant.
- `service_package_components`: combo có nhiều SKU.
- `technician_service_areas`: technician làm nhiều vùng.
- `order_status_history`: timeline nghiệp vụ khách/admin.
- `appointment_status_history`: timeline lắp đặt.
- `warranty_notes`: nhiều note tách public/internal.
- Auth.js adapter tables chính thức.
- `idempotency_keys`: nếu idempotency cần dùng ngoài order hoặc lưu response trạng thái `IN_PROGRESS`.

Không thêm nếu chưa có slice/yêu cầu sử dụng.

## 7. Invariant liên bảng

DB constraint không biểu diễn hết; application transaction phải giữ:

1. `orders.subtotal = SUM(order_items.line_total)`.
2. `payments.amount = orders.grand_total` trong MVP.
3. `order_items.product_variant_id` đang active tại checkout, nhưng sau đó được phép archive.
4. Package phải tương thích variant tại checkout.
5. `orders.user_id` sở hữu cart/address đầu vào.
6. Appointment chỉ tồn tại khi order có item/package yêu cầu lắp đặt.
7. Appointment service area khớp snapshot địa chỉ tại checkout.
8. Một appointment chiếm đúng một capacity count khi `capacity_released_at IS NULL`.
9. Inventory reservation tổng ledger mở khớp `inventory.reserved`.
10. Customer warranty sở hữu order item.
11. Technician assignment active chỉ dành cho technician active tại lúc assign.
12. Order/appointment/payment transition tuân state machine.
13. Audit được ghi cùng transaction cho admin mutation.
14. State/version update dùng expected version.
15. Không hard-delete parent có lịch sử.

Integration test bắt buộc cho invariant transaction.

## 8. Transaction và locking

### 8.1 Tạo order

Pseudo-sequence:

```text
BEGIN
  claim/check idempotency key
  SELECT cart ... FOR UPDATE
  SELECT inventory ... ORDER BY product_variant_id FOR UPDATE
  load active catalog/package and calculate price
  validate available inventory
  SELECT installation_slot ... FOR UPDATE (nếu cần)
  validate slot capacity
  INSERT order
  INSERT order_items
  INSERT inventory_allocations
  UPDATE inventory SET reserved = reserved + quantity, version = version + 1
  UPDATE installation_slots SET booked_count = booked_count + 1
  INSERT payment
  INSERT appointment (nếu cần)
  UPDATE cart SET status = CHECKED_OUT
COMMIT
```

Vấn đề: `order_items` cần tồn tại trước allocation, nhưng inventory nên được lock trước; insert order/item sau validation, rồi allocation/update trong cùng transaction.

### 8.2 Hủy order

```text
BEGIN
  SELECT order FOR UPDATE
  validate expectedVersion and transition
  SELECT allocations + inventory ORDER BY inventory_id FOR UPDATE
  release only allocations in RESERVED
  update inventory counters
  lock appointment + slot if capacity still held
  release capacity once; cancel appointment
  update order inventory_status/state/version
  insert audit if internal actor
COMMIT
```

### 8.3 Consume inventory

Thời điểm kích hoạt cần con người duyệt. Transaction:

- Lock order, allocations và inventory.
- Chỉ `RESERVED -> CONSUMED`.
- Giảm cả `reserved` và `on_hand`.
- Không chạy lại side effect nếu đã consumed.
- Ghi order transition/audit cùng transaction.

### 8.4 Reschedule

- Lock appointment.
- Lock slot cũ/mới theo ID ổn định.
- Nếu cũ vẫn chiếm capacity, decrement.
- Kiểm tra/increment slot mới.
- Cập nhật timestamps/version.
- Assignment cũ phải cancel/revalidate vì range đổi.
- Audit nếu actor nội bộ.

## 9. Index và query plan

Danh sách lớn luôn cursor pagination khi phù hợp:

- Catalog: `(status, published_at DESC, id)`.
- Customer orders: `(user_id, created_at DESC, id)`.
- Admin orders: `(status, created_at DESC, id)`.
- Appointments: `(status, scheduled_start_at, id)`.
- Technician schedule: qua assignment `(technician_id, scheduled_range)`.
- Warranty queue: `(status, created_at, id)`.
- Audit: `(occurred_at DESC, id)` và filter composite dựa đo đạc.

Không thêm index theo phỏng đoán quá mức. Mỗi query P0 cần `EXPLAIN ANALYZE` với dataset kiểm thử trước release candidate. Search full-text/trigram chỉ thêm sau khi xác định yêu cầu và migration extension.

## 10. PII và retention

### PII

- `users`: email, name, phone.
- `addresses`: recipient, phone, địa chỉ.
- `orders`: snapshot recipient/phone/address.
- `warranty_requests`: contact phone và mô tả có thể chứa PII.
- Appointment/customer note có thể chứa PII.

Controls:

- DTO theo role.
- Log/audit redact.
- Không seed PII thật.
- Backup local không chia sẻ công khai.
- Không lưu raw body.
- Encryption at rest là concern hạ tầng production, chưa thiết kế.
- Field-level encryption chưa thêm nếu chưa có threat/compliance decision.

Retention cần duyệt cho user, order, payment, warranty và audit. Không tự động purge trước quyết định pháp lý.

## 11. Migration strategy

Mỗi thay đổi DB phải có:

1. Prisma schema change dự kiến.
2. Migration SQL được review.
3. Forward migration.
4. Backfill riêng, có thể chạy lại nếu cần.
5. Compatibility window cho rename/drop.
6. Rollback plan.
7. Integration test trên PostgreSQL.
8. Backup/restore note cho thay đổi phá hủy.

Nguyên tắc expand/contract:

- Thêm nullable/new table trước.
- Deploy logic ghi/đọc tương thích trong môi trường không-production.
- Backfill.
- Thêm constraint `NOT VALID`, validate nếu PostgreSQL phù hợp.
- Chuyển sang `NOT NULL`.
- Chỉ drop cột ở task riêng sau khi xác nhận không còn consumer.

Không:

- `prisma migrate reset` trên DB có dữ liệu cần giữ.
- Xóa/reset database tự động.
- Chạy migration production.
- Dùng `db push` thay migration cho schema chia sẻ.
- Sửa migration đã được áp dụng; tạo migration mới.

## 12. Rollback cấp schema

- Migration chỉ thêm bảng/cột/index: rollback có thể drop nếu chắc chưa có dữ liệu cần giữ; nếu không, giữ cấu trúc và rollback application.
- Enum thêm giá trị khó rollback: ưu tiên không xóa value; rollback code không phát sinh value mới.
- Constraint mới gây lỗi: drop constraint cụ thể sau review, không reset DB.
- Backfill sai: dùng migration bù từ backup/nguồn dữ liệu; không delete hàng loạt thiếu điều kiện.
- Exclusion constraint technician: có thể drop constraint và rollback feature assignment, nhưng phải dừng mutation gây overlap.
- Inventory/order migration: ưu tiên forward-fix; rollback chỉ khi đối soát invariant hoàn tất.
- Mỗi slice trong `IMPLEMENTATION_PLAN.md` có rollback riêng.

## 13. Kiểm thử DB bắt buộc

- Mỗi check/unique/FK quan trọng có integration test.
- Hai transaction reserve SKU cuối chỉ một thành công.
- Release/consume chỉ xảy ra một lần.
- Hai booking slot cuối chỉ một thành công.
- Reschedule thất bại giữ booking cũ.
- Assignment range overlap bị DB từ chối.
- Idempotency cùng payload trả cùng order; payload khác conflict.
- Order money constraints từ chối tổng sai.
- Customer ownership query không trả dữ liệu khác user.
- Audit rollback nếu mutation rollback và cùng commit nếu mutation commit.
- Migration up chạy trên DB sạch và DB có fixture phiên bản trước.
- Không dùng SQLite cho các test này.

## 14. Điểm cần con người duyệt

1. ID chuẩn: UUID v4/v7 hay CUID2.
2. Auth.js provider và các bảng adapter chính thức.
3. Combo package một variant hay nhiều SKU.
4. Có dùng `inventory_allocations` làm source of truth; khuyến nghị có.
5. Mốc consume inventory.
6. Slot được cấu hình từng ngày hay sinh từ template; baseline cần row từng slot để lock.
7. Thời lượng appointment cố định theo slot hay tính theo package.
8. Một hay nhiều technician/appointment; baseline một active assignment.
9. Có cần lịch sử trạng thái riêng.
10. Quy tắc chuẩn hóa/match địa chỉ.
11. Warranty eligibility và nhiều request/item.
12. Retention/anonymization PII và audit.
13. PostgreSQL version tối thiểu; khuyến nghị 15+ cho constraint/index thuận lợi.
14. Dùng DB enum hay text + check; cần chọn trước migration.
