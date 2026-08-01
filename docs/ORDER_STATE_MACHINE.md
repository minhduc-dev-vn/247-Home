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
| `PENDING_CONFIRMATION` | `cancel` | `CANCELLED` | CUSTOMER owner; STAFF/MANAGER/ADMIN | unpaid payment, no active online session, `expectedVersion` | Release reserved inventory/slot exactly once; audit |
| `CONFIRMED` | `cancel` | `CANCELLED` | STAFF/MANAGER/ADMIN | unpaid payment, no active online session, `expectedVersion` | Release reserved inventory/slot exactly once; audit |
| `PROCESSING` | `cancel` | `CANCELLED` | MANAGER/ADMIN | inventory is still `RESERVED`; unpaid payment; `expectedVersion` | Release reserved inventory/slot exactly once; audit |
| `PENDING_CONFIRMATION` | `expire` | `CANCELLED` | MANAGER/ADMIN maintenance action | bounded operator-supplied cutoff, unpaid payment, no active online session | Same release transaction and `order.expire` audit |

### Cancellation and expiry policy implemented in Phase 3

- A customer can cancel only their own `PENDING_CONFIRMATION` order. If it has
  an appointment, the appointment must still be `SCHEDULED` or
  `ASSIGNMENT_PENDING`.
- STAFF can cancel an unconsumed `PENDING_CONFIRMATION` or `CONFIRMED` order.
  MANAGER and ADMIN can additionally cancel `PROCESSING`. Operations can cancel
  only an appointment in `SCHEDULED`, `ASSIGNMENT_PENDING`, `ASSIGNED`, or
  `RESCHEDULE_REQUIRED`; active installation states cannot be cancelled through
  this path.
- `expire` is not a timer or background job. It is an explicit, bounded
  MANAGER/ADMIN maintenance action over an operator-supplied UTC cutoff. The
  command defaults to 25 orders and rejects a limit above 100.
- `PAID` and `REFUNDED` payment records are rejected. A still-payable VNPAY
  session (`CREATED`/`PENDING` with a future expiry) is rejected to prevent a
  local cancellation from racing an external payment. Expired local sessions
  are marked `EXPIRED` in the transaction; unpaid payment records in
  `CREATED`, `PENDING`, or `PROCESSING` become `CANCELLED`.
- A cancellation moves each allocation `RESERVED -> RELEASED`, decreases only
  `inventory.reserved` (never `onHand`), cancels the appointment, decrements
  the slot once, and cancels active technician assignments. The order is then
  conditionally updated to `CANCELLED`; one redacted audit record is written
  for every actor, including a customer.
- The canceled checkout/idempotency key is never reactivated. A new checkout is
  required to reserve released inventory again. Customer notification is not
  implemented in this repository and remains an Operations/support procedure.

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
- Creating an idempotent provider session moves it to `PROCESSING`. At most one
  `CREATED`/`PENDING` session with a future expiry may be payable for a payment.
  The same idempotency key replays that same session; a different key is
  rejected while it remains active. A replacement is permitted only after the
  prior local session is atomically marked `EXPIRED`.
- New customer VNPay sessions are disabled unless the explicit server-side
  public-enable gate is approved and configured. Disabling new issuance does
  not discard or invalidate a signed IPN for an existing session.
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

- A signed amount/currency mismatch is persisted as a rejected provider event;
  a second provider transaction or a terminal-state callback is persisted for
  reconciliation. Neither path can make a second order transition or audit
  event.

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

For `cancel` and `expire`, the transaction locks the order, then its payment,
then inventory rows by product-variant ID, appointment, and installation slot.
It verifies every allocation is still `RESERVED`, conditionally decrements only
`reserved`, conditionally releases appointment capacity, conditionally updates
the order with `id + expectedVersion + status + inventoryStatus`, and creates
the audit record before commit. A reservation, slot, payment, order, or audit
failure rolls back every write. A stale retry receives `409` and cannot release
stock or capacity a second time.

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

Audit bắt buộc cho mọi cancel/expire transition va cho transition do STAFF/MANAGER/ADMIN:

- actor và role snapshot;
- action, from/to;
- order ID;
- reason;
- request ID;
- dữ liệu before/after đã redact.

Customer cancellation is also recorded as `order.cancel`; audit payloads do not
contain full address, token, or payment credentials.

## 10. Test bắt buộc

- Mọi transition hợp lệ theo table thành công.
- Mọi cặp from/action khác bị từ chối.
- Terminal state không đổi.
- Customer chi huy order own o `PENDING_CONFIRMATION`; STAFF/MANAGER/ADMIN
  cancellation and explicit manager/admin expiry follow the table above.
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
3. **Phase 3 baseline:** customer cancel only at `PENDING_CONFIRMATION`; no
   automatic expiry or cancellation deadline exists until Product/Operations
   approve a new policy.
4. Có phí hủy hoặc xử lý đơn đã consume không.
5. COD được đánh dấu paid ở mốc nào.
6. Đơn không cần lắp dùng state nào.
7. Có cần `FAILED`, `EXPIRED`, `REFUNDED`, `RETURNED`; hiện ngoài MVP.
8. Có cần status history table cho customer timeline.
