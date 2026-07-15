# 247 Home — User Flows

## 1. Quy ước

- **Actor**: người thực hiện.
- **Precondition**: điều kiện trước.
- **Happy path**: luồng thành công.
- **Exception**: nhánh lỗi hoặc cạnh tranh.
- Mọi mutation đều được validation và authorization tại server.
- Giá, tồn kho, vùng phục vụ và slot luôn được server kiểm tra lại.
- Thời gian lưu UTC, hiển thị theo `Asia/Ho_Chi_Minh`.

## 2. Ma trận hành trình

| Mã | Luồng | Actor | Ưu tiên |
|---|---|---|---|
| UF-01 | Khám phá sản phẩm/combo | Anonymous, CUSTOMER | P0 |
| UF-02 | Kiểm tra vùng phục vụ | Anonymous, CUSTOMER | P0 |
| UF-03 | Quản lý giỏ hàng | CUSTOMER | P0 |
| UF-04 | Checkout và đặt đơn | CUSTOMER | P0 |
| UF-05 | Theo dõi đơn và lịch | CUSTOMER | P0 |
| UF-06 | Hủy đơn/đổi lịch | CUSTOMER, STAFF, MANAGER | P0 |
| UF-07 | Xử lý đơn và thanh toán | STAFF, MANAGER | P0 |
| UF-08 | Quản lý catalog/tồn kho | STAFF, MANAGER, ADMIN | P0 |
| UF-09 | Quản lý vùng và slot | MANAGER, ADMIN | P0 |
| UF-10 | Phân công và thực hiện lắp đặt | STAFF, MANAGER, TECHNICIAN | P0 |
| UF-11 | Bảo hành | CUSTOMER, STAFF, MANAGER | P0 |
| UF-12 | Xem audit log | MANAGER, ADMIN | P0 |
| UF-13 | Quản trị role | ADMIN | P0 |

## 3. Luồng khách hàng

### UF-01 — Khám phá sản phẩm/combo

**Precondition:** Không yêu cầu đăng nhập.

1. Người dùng mở catalog.
2. Server chỉ trả sản phẩm/biến thể có trạng thái công khai.
3. Người dùng tìm kiếm hoặc lọc theo nhóm và khoảng giá.
4. Người dùng mở trang chi tiết.
5. Server trả ảnh, mô tả, biến thể, giá hiện hành, tình trạng hàng gần đúng và gói dịch vụ tương thích.
6. Người dùng chọn biến thể/gói.

**Exception:**

- Sản phẩm ngừng bán giữa hai request: trang cho biết không còn khả dụng; không cho thêm vào giỏ.
- SKU hết hàng: vẫn có thể hiển thị nhưng nút mua bị vô hiệu theo kết quả server.
- Không tìm thấy slug: trả `404`, không lộ dữ liệu draft.

**Acceptance:**

- Anonymous không thấy sản phẩm draft/archived.
- Giá hiển thị lấy từ server.
- URL lọc có thể chia sẻ và phân trang ổn định.

### UF-02 — Kiểm tra vùng phục vụ

1. Người dùng nhập tỉnh/thành, quận/huyện, phường/xã và tùy chọn mã bưu chính.
2. Client gửi dữ liệu địa lý, không tự kết luận hỗ trợ.
3. Server chuẩn hóa và đối chiếu `service_areas`.
4. Server trả `SUPPORTED`, `UNSUPPORTED` hoặc `AMBIGUOUS`.
5. Nếu hỗ trợ, UI cho phép xem slot sơ bộ.

**Exception:**

- Dữ liệu thiếu/sai: lỗi validation theo trường.
- Nhiều vùng khớp: yêu cầu chọn lại địa chỉ chuẩn hóa.
- Vùng bị tắt sau kiểm tra: checkout kiểm tra lại và chặn.

### UF-03 — Quản lý giỏ hàng

**Precondition:** CUSTOMER đã đăng nhập trong MVP.

1. Khách chọn variant, service package tùy chọn và số lượng.
2. Server validation ID, trạng thái bán, tương thích và giới hạn số lượng.
3. Server upsert `cart_items`.
4. Khi xem giỏ, pricing service tải giá mới và tính quote.
5. UI hiển thị thay đổi giá/hết hàng theo từng dòng.
6. Khách cập nhật số lượng hoặc xóa dòng.

**Exception:**

- Item không tồn tại/không được bán: `404` hoặc lỗi item không khả dụng.
- Số lượng vượt tồn kho hiện có: `409 INVENTORY_INSUFFICIENT`.
- Package không tương thích: `422 PACKAGE_NOT_COMPATIBLE`.
- Quote hết hạn trước checkout: server tính lại; khách xác nhận tổng mới.

**Lưu ý:** Giỏ không giữ hàng. Chỉ checkout tạo reservation.

### UF-04 — Checkout và đặt đơn

**Precondition:**

- CUSTOMER đăng nhập.
- Giỏ không rỗng.
- Có địa chỉ hợp lệ.
- Nếu có lắp đặt: vùng được hỗ trợ và đã chọn slot.
- Client tạo `Idempotency-Key` duy nhất cho một lần xác nhận.

**Happy path:**

1. Khách mở checkout.
2. Server tạo quote mới từ DB.
3. Khách chọn/nhập địa chỉ; server kiểm tra ownership và vùng.
4. Server trả slot còn khả dụng; khách chọn một slot nếu cần lắp đặt.
5. Khách chọn `COD` hoặc `BANK_TRANSFER`.
6. Client gửi ID địa chỉ, phương thức thanh toán, slot và `Idempotency-Key`; không gửi giá đáng tin cậy.
7. Server mở transaction:
   1. Khóa cart và các inventory row theo ID ổn định.
   2. Tải lại trạng thái variant/package và tính lại giá.
   3. Kiểm tra/tăng `inventory.reserved`.
   4. Nếu cần lắp đặt, khóa slot/capacity tương ứng và tạo appointment.
   5. Tạo order, item snapshot, payment `PENDING`.
   6. Đánh dấu cart đã checkout hoặc tạo cart mới rỗng.
8. Commit transaction.
9. Server trả order code, tổng tiền, trạng thái và hướng dẫn thanh toán nếu chuyển khoản.
10. UI chuyển tới chi tiết đơn.

**Exception:**

- Cùng `Idempotency-Key` và cùng payload: trả kết quả đơn đã tạo.
- Cùng key nhưng payload khác: `409 IDEMPOTENCY_KEY_REUSED`.
- Thiếu tồn kho: rollback toàn bộ, `409 INVENTORY_INSUFFICIENT`.
- Slot hết capacity: rollback toàn bộ, `409 SLOT_UNAVAILABLE`.
- Giá đổi: trả `409 PRICE_CHANGED` cùng quote mới hoặc yêu cầu xác nhận lại; không dùng tổng cũ.
- Deadlock/serialization failure: server retry giới hạn với transaction idempotent; hết retry trả lỗi tạm thời.
- Không tạo order nửa vời, reservation mồ côi hoặc appointment không gắn order.

### UF-05 — Theo dõi đơn và lịch

1. CUSTOMER mở danh sách đơn của mình.
2. Server scope query theo `user_id`.
3. Khách mở chi tiết.
4. Server trả order state, payment state, item/address snapshot, appointment và timeline được phép.
5. Nếu đã phân công, chỉ hiển thị thông tin kỹ thuật viên tối thiểu được duyệt.

**Exception:**

- Đoán ID đơn người khác: trả `404` để giảm rủi ro IDOR.
- Đơn không cần lắp đặt: không có appointment.
- Ghi chú nội bộ/audit payload không bao giờ trả cho CUSTOMER.

### UF-06 — Hủy đơn hoặc đổi lịch

#### Hủy đơn

1. Actor yêu cầu hủy và cung cấp lý do.
2. Server kiểm tra ownership/role và transition theo `ORDER_STATE_MACHINE.md`.
3. Transaction cập nhật order version/state.
4. Nếu reservation chưa tiêu thụ, giải phóng đúng một lần.
5. Appointment đang chờ được hủy theo `INSTALLATION_STATE_MACHINE.md`.
6. Mutation quản trị tạo audit log; hành động khách tạo business event/timeline.
7. Trả trạng thái mới.

Nhánh lỗi: trạng thái không cho hủy trả `409 INVALID_STATE_TRANSITION`; version cũ trả `409 CONCURRENT_MODIFICATION`.

#### Đổi lịch

1. Actor xem slot thay thế.
2. Chọn slot và gửi `expectedVersion`.
3. Server kiểm tra quyền, deadline đổi lịch và trạng thái.
4. Transaction khóa appointment cùng capacity slot cũ/mới theo thứ tự ổn định.
5. Giải phóng slot cũ, giữ slot mới và tăng version.
6. Tạo audit nếu actor nội bộ.

Nhánh lỗi: slot mới đầy thì rollback, lịch cũ giữ nguyên.

## 4. Luồng vận hành

### UF-07 — Xử lý đơn và thanh toán

1. STAFF/MANAGER tìm đơn bằng mã, trạng thái hoặc thời gian.
2. Server phân trang và lọc theo quyền.
3. Actor xem chi tiết cần thiết.
4. Actor thực hiện action nghiệp vụ, không sửa state tùy ý:
   - xác nhận chuyển khoản;
   - xác nhận COD đã thu;
   - bắt đầu xử lý;
   - đánh dấu sẵn sàng/lắp đặt;
   - hoàn tất hoặc hủy theo policy.
5. Server validation `expectedVersion`, payment/order transition.
6. Transaction cập nhật dữ liệu và inventory nếu transition yêu cầu.
7. Ghi audit với actor, action, target, before/after đã lọc và lý do.

**Exception:**

- Xác nhận thanh toán hai lần: action idempotent hoặc `409`.
- STAFF không có quyền action nhạy cảm: `403`.
- Không sửa `grand_total`, item snapshot hay payment amount trực tiếp.

### UF-08 — Quản lý catalog và tồn kho

#### Catalog

1. Actor được phép tạo/sửa product, variant, image hoặc package.
2. Server validation slug/SKU duy nhất, giá integer VND, quan hệ hợp lệ.
3. Publish chỉ thành công khi có ít nhất một variant hợp lệ.
4. Server lưu và tạo audit log.

#### Tồn kho

1. Actor chọn variant và nhập delta hoặc giá trị mục tiêu cùng lý do.
2. Server kiểm tra quyền nâng cao.
3. Transaction khóa inventory row.
4. Server bảo đảm invariant `0 <= reserved <= on_hand`.
5. Cập nhật version và audit before/after.

Không cho giảm `on_hand` thấp hơn `reserved`; không xóa row tồn kho đang được tham chiếu.

### UF-09 — Quản lý vùng phục vụ và slot

1. MANAGER/ADMIN tạo hoặc sửa vùng bằng mã địa lý chuẩn.
2. Server ngăn vùng active chồng lấn không rõ precedence.
3. Actor cấu hình ngày, giờ bắt đầu/kết thúc và capacity.
4. Server kiểm tra timezone, giờ hợp lệ, capacity không âm.
5. Giảm capacity dưới số booking hiện có bị chặn.
6. Mọi mutation tạo audit.

### UF-10 — Phân công và thực hiện lắp đặt

#### Phân công

1. MANAGER/ADMIN mở appointment `ASSIGNMENT_PENDING`.
2. Server liệt kê technician active phù hợp vùng/kỹ năng và chưa trùng lịch.
3. Actor chọn technician.
4. Transaction khóa appointment và assignment liên quan.
5. Server kiểm tra lại xung đột, tạo assignment active và chuyển state hợp lệ.
6. Tạo audit.

#### Kỹ thuật viên thực hiện

1. TECHNICIAN mở danh sách assignment của mình.
2. Server scope theo technician liên kết với session user.
3. Technician xem thông tin tối thiểu cần thi công.
4. Technician thực hiện action theo thứ tự: `ACCEPT` (timestamp), `EN_ROUTE`, `ARRIVE`, `START`, `COMPLETE`.
5. Server kiểm tra assignment, thời điểm và transition.
6. Cập nhật appointment; ghi business event và audit phù hợp.

**Exception:**

- Technician khác truy cập: `404`.
- Hai người cùng phân công: unique/locking ngăn assignment active trùng.
- Technician bị vô hiệu hóa: không nhận assignment mới; lịch hiện tại cần MANAGER xử lý.

### UF-11 — Bảo hành

#### Khách gửi yêu cầu

1. CUSTOMER chọn order item thuộc đơn của mình.
2. Server kiểm tra order đã đủ điều kiện và thời hạn bảo hành.
3. Khách chọn loại lỗi, mô tả, contact preference.
4. Server validation, sanitize và tạo `warranty_request` ở `SUBMITTED`.
5. Khách nhận mã yêu cầu.

#### Vận hành xử lý

1. STAFF/MANAGER xem queue.
2. Nhận xử lý và chuyển `UNDER_REVIEW`.
3. Ghi public note hoặc internal note tách biệt.
4. Chuyển `APPROVED`, `REJECTED`, `IN_SERVICE`, `RESOLVED` hoặc `CLOSED` theo quy tắc.
5. Mỗi mutation tạo audit.
6. CUSTOMER chỉ thấy status, lý do công khai và public notes.

## 5. Luồng quản trị nền tảng

### UF-12 — Xem audit log

1. MANAGER/ADMIN mở audit.
2. Server áp dụng quyền: MANAGER chỉ domain được phép; ADMIN phạm vi toàn ứng dụng.
3. Actor lọc theo thời gian, actor, action, target type.
4. Server trả dữ liệu phân trang, đã redact.
5. Audit log chỉ đọc qua ứng dụng; không có API sửa/xóa.

### UF-13 — Quản trị role

1. ADMIN tìm user.
2. ADMIN chọn role cần gán/gỡ và nhập lý do.
3. Server ngăn tự loại bỏ ADMIN cuối cùng và kiểm tra policy.
4. Transaction cập nhật `user_roles`.
5. Session/authorization mới phản ánh thay đổi theo chiến lược refresh.
6. Ghi audit không thể bị bỏ qua.

## 6. Trạng thái lỗi UX chuẩn

| Mã | Hành vi UI |
|---|---|
| `VALIDATION_ERROR` | Gắn lỗi đúng trường, giữ dữ liệu không nhạy cảm |
| `UNAUTHENTICATED` | Chuyển đăng nhập, giữ return URL an toàn |
| `FORBIDDEN` | Trang không đủ quyền, không lộ dữ liệu |
| `NOT_FOUND` | Thông báo tài nguyên không tồn tại/không truy cập được |
| `PRICE_CHANGED` | Hiển thị quote mới và yêu cầu xác nhận |
| `INVENTORY_INSUFFICIENT` | Chỉ dòng thiếu hàng, cho sửa giỏ |
| `SLOT_UNAVAILABLE` | Giữ checkout, yêu cầu chọn slot khác |
| `INVALID_STATE_TRANSITION` | Refresh dữ liệu và giải thích action không còn hợp lệ |
| `CONCURRENT_MODIFICATION` | Refresh phiên bản mới, không ghi đè |
| `RATE_LIMITED` | Hiển thị thời gian thử lại |
| `INTERNAL_ERROR` | Mã correlation, không lộ stack trace |

## 7. Test hành trình P0

- Anonymous chỉ xem catalog công khai.
- Customer A không đọc/sửa đơn, địa chỉ, cart, warranty của Customer B.
- Giỏ phản ánh giá mới từ server.
- Client giả `grand_total` không thay đổi đơn.
- Hai checkout tranh SKU cuối: đúng một request thành công.
- Hai checkout tranh slot cuối: đúng một request thành công.
- Retry cùng idempotency key không tạo đơn thứ hai.
- Hủy đơn giải phóng reservation một lần.
- Đổi slot thất bại không làm mất slot cũ.
- Technician chỉ thấy assignment của mình.
- Role không phù hợp không gọi được admin action.
- Mỗi mutation admin P0 sinh đúng audit event đã redact.
