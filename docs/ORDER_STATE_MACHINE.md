# 247 Home — Order State Machine

## 1. Nguyên tắc

- Trạng thái đơn chỉ đổi qua action nghiệp vụ tại server, không `PATCH status` tùy ý.
- Mọi action parse bằng Zod, kiểm authentication, role, ownership, state và `expectedVersion`.
- Transition cùng side effect inventory, payment, appointment và audit phải nằm trong transaction.
- CUSTOMER chỉ hủy đơn của mình khi policy cho phép. STAFF/MANAGER/ADMIN dùng quyền cụ thể.
- Không cho role nào bỏ qua state machine.
- Terminal states: `COMPLETED`, `CANCELLED`.
- Payment có state machine riêng nhưng guard order tham chiếu trạng thái payment.
- Inventory lifecycle: `RESERVED`, `CONSUMED`, `RELEASED`.
- Mốc consume inventory đã được chốt tại `PROCESSING -> READY_FOR_INSTALLATION` và được thực thi nguyên tử cùng order transition và audit.

## 2. Trạng thái

| State | Ý nghĩa | Inventory | Appointment |
|---|---|---|---|
| `PENDING_CONFIRMATION` | Đơn vừa tạo, chờ xác nhận nghiệp vụ/thanh toán theo policy | `RESERVED` | Đã giữ slot nếu cần |
| `CONFIRMED` | Đơn hợp lệ và được chấp nhận xử lý | `RESERVED` | Scheduled nếu cần |
| `PROCESSING` | Đang chuẩn bị thiết bị/dịch vụ | `RESERVED` | Đang chuẩn bị/phân công |
| `READY_FOR_INSTALLATION` | Thiết bị đã xuất/chuẩn bị xong | `CONSUMED` baseline | Phải sẵn sàng nếu đơn cần lắp |
| `INSTALLATION_IN_PROGRESS` | Kỹ thuật viên đang thi công | `CONSUMED` | `IN_PROGRESS` |
| `COMPLETED` | Đơn hoàn tất | `CONSUMED` | `COMPLETED` nếu cần |
| `CANCELLED` | Đơn hủy | `RELEASED` nếu chưa consume; policy ngoại lệ nếu đã consume | Hủy/giải phóng capacity nếu còn giữ |

Đơn không cần lắp đặt vẫn dùng `READY_FOR_INSTALLATION` như “ready for fulfillment” trong baseline để giữ enum tối thiểu. Tên `READY_FOR_FULFILLMENT` nên được cân nhắc trước migration nếu hàng không lắp đặt chiếm tỷ trọng lớn.

## 3. Sơ đồ

```text
PENDING_CONFIRMATION
   | confirm
   v
CONFIRMED
   | start-processing
   v
PROCESSING
   | mark-ready-for-installation
   v
READY_FOR_INSTALLATION
   | installation-started (đơn cần lắp)
   v
INSTALLATION_IN_PROGRESS
   | installation-completed
   v
COMPLETED

READY_FOR_INSTALLATION -- complete-without-installation --> COMPLETED

PENDING_CONFIRMATION -- cancel --> CANCELLED
CONFIRMED            -- cancel --> CANCELLED
PROCESSING           -- cancel-with-policy --> CANCELLED
```

Không có transition ra khỏi terminal state.

## 4. Transition table

| From | Action | To | Actor | Guard chính | Side effect nguyên tử |
|---|---|---|---|---|---|
| `PENDING_CONFIRMATION` | `confirm` | `CONFIRMED` | STAFF có quyền, MANAGER, ADMIN; system rule nếu được duyệt | Order hợp lệ; payment policy đạt | Timestamp confirm, version++, audit nếu internal |
| `CONFIRMED` | `start-processing` | `PROCESSING` | STAFF/MANAGER/ADMIN | Không cancelled; expectedVersion đúng | version++, audit |
| `PROCESSING` | `mark-ready-for-installation` | `READY_FOR_INSTALLATION` | STAFF/MANAGER/ADMIN | Đủ hàng reserved; appointment tồn tại nếu cần | `RESERVED -> CONSUMED`, giảm `reserved` và `on_hand` đúng một lần, audit |
| `READY_FOR_INSTALLATION` | `installation-started` | `INSTALLATION_IN_PROGRESS` | Orchestration từ installation use case | Appointment chuyển `IN_PROGRESS` thành công | Đồng bộ order state trong cùng transaction |
| `INSTALLATION_IN_PROGRESS` | `installation-completed` | `COMPLETED` | Orchestration từ installation use case | Appointment `COMPLETED`; payment policy đạt | Set completed, version++, audit/event |
| `READY_FOR_INSTALLATION` | `complete-without-installation` | `COMPLETED` | STAFF/MANAGER/ADMIN | Đơn không yêu cầu lắp; payment policy đạt | Set completed, audit |
| `PENDING_CONFIRMATION` | `cancel` | `CANCELLED` | CUSTOMER own, STAFF/MANAGER/ADMIN | Chính sách hủy; reason | Release inventory/slot đúng một lần; cancel payment pending; audit nếu internal |
| `CONFIRMED` | `cancel` | `CANCELLED` | CUSTOMER own theo deadline; STAFF/MANAGER/ADMIN | Chính sách hủy; reason | Release inventory/slot; cancel payment pending; audit |
| `PROCESSING` | `cancel` | `CANCELLED` | MANAGER/ADMIN baseline | Chưa consume; lý do bắt buộc | Release inventory/slot; audit |

## 5. Transition bị cấm

- Chuyển lùi trạng thái để “sửa”.
- Hủy bình thường sau `READY_FOR_INSTALLATION`, `INSTALLATION_IN_PROGRESS` hoặc `COMPLETED`.
- Complete đơn cần lắp khi appointment chưa `COMPLETED`.
- Start installation khi chưa có active assignment.
- Consume inventory nhiều lần.
- Release inventory đã `CONSUMED`.
- Confirm payment bằng order action; dùng payment action riêng.
- Sửa tổng tiền hoặc snapshot item trong bất kỳ transition nào.

Ngoại lệ sau consume cần workflow return/refund/stock reconciliation riêng, ngoài MVP; không ép thành `CANCELLED`.

## 6. Payment guards

### COD

- Tạo payment `PENDING`.
- Order có thể được `confirm` trước khi thu COD.
- Trước `COMPLETED`, policy phải xác định COD được xác nhận `PAID` cùng lúc hoặc bởi STAFF.
- Không tự động lưu thông tin thẻ.

### BANK_TRANSFER

Baseline khuyến nghị:

- Chỉ `confirm` order khi payment `PAID`.
- STAFF/MANAGER có permission xác nhận thủ công qua payment action.

### VNPAY

- Checkout creates the payment from the database total in `PENDING`.
- Creating an idempotent provider session moves it to `PROCESSING`.
- Only a valid HMAC-SHA512 IPN may move it to `PAID` or `FAILED`.
- A verified `PAID` IPN conditionally changes an order from
  `PENDING_CONFIRMATION` to `CONFIRMED` in the same transaction.
- Browser return data never changes state. Manual staff payment actions are not
  available for VNPay.
- Installation start/completion and completion without installation continue
  to require `PAID`; therefore a pending or failed online payment cannot enter
  installation execution.
- Payment `FAILED` khi order còn `PENDING_CONFIRMATION` có thể cho khách thử đối soát lại hoặc hủy; không tạo gateway retry.
- Payment amount luôn bằng `orders.grand_total`, không nhận từ client.

### Manual payment action

- Payment states: `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `CANCELLED`.
- `CONFIRM_PAYMENT` only transitions `PENDING -> PAID`; `REJECT_PAYMENT` only
  transitions `PENDING -> FAILED`. `REFUNDED` is reserved for a later return
  and refund workflow.
- STAFF, MANAGER, and ADMIN act through the server-side payment policy with an
  `expectedVersion` and reason. The conditional update, version increment, and
  audit are in one transaction.
- Installation completion locks appointment and order, then requires payment
  `PAID` in the same transaction before completing the linked records.

## 7. Concurrency và idempotency

Mỗi transition:

1. Khóa order bằng `SELECT ... FOR UPDATE` trong transaction.
2. So `expectedVersion` và kiểm action bằng policy server-side duy nhất.
3. Khóa resource side effect theo thứ tự ID ổn định.
4. Thực hiện side effect chỉ khi lifecycle hiện tại cho phép.
5. Conditional update order theo `id + expectedVersion + expected current status + expected inventory status`.
6. Yêu cầu số row update đúng bằng `1`, sau đó tăng version đúng một lần.
7. Ghi audit cùng transaction nếu actor nội bộ.
8. Commit; bất kỳ lỗi guard, inventory hoặc audit nào đều rollback toàn bộ.

Riêng `mark-ready-for-installation`, transaction phải khóa toàn bộ inventory theo product variant ID ổn định, xác minh mỗi order item có đúng một `inventory_allocations` row ở trạng thái `RESERVED` với đúng variant/quantity, rồi giảm đồng thời `onHand` và `reserved`, chuyển allocation sang `CONSUMED`, và conditional-update order. Thiếu hoặc sai ownership reservation, hay bất kỳ inventory/allocation write nào thất bại, sẽ rollback inventory, allocations, order và audit.

Request lặp:

- Request lặp với `expectedVersion` cũ trả `409 CONCURRENT_MODIFICATION`; không chạy lại side effect và không tạo audit trùng.
- Nếu current state không khớp action nhưng version vẫn đúng, trả `409 INVALID_STATE_TRANSITION`.
- Không retry lỗi business conflict.
- Retry deadlock/serialization failure có giới hạn và không nhân side effect.

`complete-without-installation` chỉ hợp lệ khi order ở `READY_FOR_INSTALLATION`, inventory đã `CONSUMED`, không có appointment và payment đã `PAID` cho cả COD lẫn chuyển khoản.

## 8. Quan hệ với installation state

- Checkout tạo order `PENDING_CONFIRMATION` và appointment `SCHEDULED` nếu cần.
- Order cancel gọi installation cancel trong cùng transaction.
- Appointment `IN_PROGRESS` phát action nội bộ `installation-started`.
- Appointment `COMPLETED` phát action nội bộ `installation-completed`.
- Appointment `RESCHEDULE_REQUIRED` không tự đổi order state.
- Không dùng event bus; orchestration là lời gọi module nội bộ trong modular monolith.

## 9. Audit và lịch sử

Audit bắt buộc cho transition do STAFF/MANAGER/ADMIN:

- actor và role snapshot;
- action, from/to;
- order ID;
- reason;
- request ID;
- dữ liệu before/after đã redact.

Action CUSTOMER được ghi business timeline nếu bảng history được duyệt, nhưng không nhất thiết là admin audit. Không ghi địa chỉ đầy đủ, token hoặc payment credential vào audit.

## 10. Test bắt buộc

- Mọi transition hợp lệ theo table thành công.
- Mọi cặp from/action khác bị từ chối.
- Terminal state không đổi.
- Customer chỉ hủy order own và đúng deadline.
- Payment guard COD/chuyển khoản đúng policy.
- Consume/release inventory đúng một lần.
- Hai transition cùng version: tối đa một thành công.
- Cancel cạnh tranh consume không phá invariant.
- Cancel giải phóng appointment capacity đúng một lần.
- Audit commit/rollback cùng admin transition.
- Order cần lắp không complete trước appointment.
- Client không thể gọi action nội bộ installation.

## 11. Quyết định và điểm cần con người duyệt

1. Khi nào order được confirm cho COD và chuyển khoản.
2. **Đã duyệt:** consume inventory khi chuyển sang `READY_FOR_INSTALLATION`.
3. Customer được hủy đến state/deadline nào.
4. Có phí hủy hoặc xử lý đơn đã consume không.
5. COD được đánh dấu paid ở mốc nào.
6. Đơn không cần lắp dùng state nào.
7. Có cần `FAILED`, `EXPIRED`, `REFUNDED`, `RETURNED`; hiện ngoài MVP.
8. Có cần status history table cho customer timeline.
