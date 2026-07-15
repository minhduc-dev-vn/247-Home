# 247 Home — Installation State Machine

## 1. Nguyên tắc

- Appointment đổi trạng thái qua action server, không update state tùy ý.
- Mọi action kiểm role, ownership/assignment, current state và `expectedVersion`.
- Booking/reschedule/cancel khóa row slot; không vượt capacity.
- Assignment kiểm technician active, phù hợp vùng/kỹ năng và không trùng lịch.
- Mutation nội bộ có audit cùng transaction.
- Terminal states: `COMPLETED`, `CANCELLED`.
- TECHNICIAN chỉ thao tác appointment có assignment active của mình.

## 2. Trạng thái

| State | Ý nghĩa |
|---|---|
| `SCHEDULED` | Slot đã giữ khi checkout |
| `ASSIGNMENT_PENDING` | Cần phân công kỹ thuật viên |
| `ASSIGNED` | Đã có assignment active |
| `EN_ROUTE` | Technician đang di chuyển |
| `ARRIVED` | Technician đã đến địa điểm lắp đặt |
| `IN_PROGRESS` | Đang lắp đặt |
| `COMPLETED` | Đã lắp đặt xong |
| `RESCHEDULE_REQUIRED` | Không thể tiếp tục; vận hành cần chọn slot mới |
| `CANCELLED` | Lịch đã hủy, capacity đã giải phóng |

## 3. Luồng chính

```text
SCHEDULED
  | request-assignment
  v
ASSIGNMENT_PENDING
  | assign
  v
ASSIGNED
  | en-route
  v
EN_ROUTE
  | arrive
  v
ARRIVED
  | start
  v
IN_PROGRESS
  | complete
  v
COMPLETED

ASSIGNED / EN_ROUTE / ARRIVED
  | report-issue
  v
RESCHEDULE_REQUIRED
  | reschedule
  v
ASSIGNMENT_PENDING

ASSIGNMENT_PENDING / ASSIGNED
  | cancel
  v
CANCELLED
```

Lựa chọn đã triển khai: checkout có gói lắp đặt tạo thẳng `ASSIGNMENT_PENDING`. `SCHEDULED` được giữ trong enum để đọc dữ liệu lịch sử và cho luồng điều phối tương lai, nhưng checkout hiện tại không để appointment mắc kẹt ở trạng thái này.

## 4. Transition table

| From | Action | To | Actor | Guard/side effect |
|---|---|---|---|---|
| `SCHEDULED` | `request-assignment` | `ASSIGNMENT_PENDING` | System/STAFF | Order đã confirm; version++ |
| `ASSIGNMENT_PENDING` | `assign` | `ASSIGNED` | STAFF có quyền/MANAGER/ADMIN | Technician active, phù hợp, không overlap; tạo assignment; audit |
| `ASSIGNED` | `accept` | `ASSIGNED` | Assigned TECHNICIAN | Ghi `accepted_at`; đây là xác nhận, không phải trạng thái riêng |
| `ASSIGNED` | `en-route` | `EN_ROUTE` | Assigned TECHNICIAN | Assignment active |
| `EN_ROUTE` | `arrive` | `ARRIVED` | Assigned TECHNICIAN | Ghi `arrived_at` |
| `ARRIVED` | `start` | `IN_PROGRESS` | Assigned TECHNICIAN | Order `READY_FOR_INSTALLATION`; đổi order sang `INSTALLATION_IN_PROGRESS` trong cùng transaction |
| `IN_PROGRESS` | `complete` | `COMPLETED` | Assigned TECHNICIAN | Completion note/checklist hợp lệ; complete assignment; gọi order completion |
| `ASSIGNED`, `EN_ROUTE`, `ARRIVED` | `report-issue` | `RESCHEDULE_REQUIRED` | Assigned TECHNICIAN/STAFF | Reason bắt buộc; cancel assignment active; audit |
| `RESCHEDULE_REQUIRED` | `reschedule` | `ASSIGNMENT_PENDING` | STAFF/MANAGER/ADMIN | Slot mới còn capacity; đổi slot nguyên tử; audit |
| `SCHEDULED`, `ASSIGNMENT_PENDING`, `ASSIGNED`, `RESCHEDULE_REQUIRED` | `reschedule` | `ASSIGNMENT_PENDING` | MANAGER/ADMIN | Lock slot cũ/mới; release/book đúng một lần; cancel assignment cũ |
| `ASSIGNMENT_PENDING`, `ASSIGNED` | `cancel` | `CANCELLED` | Order orchestration; MANAGER/ADMIN theo policy | Release capacity đúng một lần; cancel assignment; audit nếu internal |

Cancel sau `EN_ROUTE` hoặc `IN_PROGRESS` cần escalation riêng, ngoài luồng hủy chuẩn.

## 5. Invariant

1. Appointment active giữ đúng một capacity: `capacity_released_at IS NULL`.
2. `booked_count <= capacity`.
3. Reschedule thất bại phải giữ slot cũ.
4. Tối đa một active assignment/appointment trong baseline.
5. Technician không có hai assignment active với `scheduled_range` overlap.
6. `scheduled_end_at > scheduled_start_at`.
7. `IN_PROGRESS` chỉ được tạo từ `ARRIVED` và yêu cầu order `READY_FOR_INSTALLATION`; order đổi sang `INSTALLATION_IN_PROGRESS` trong cùng transaction.
8. `COMPLETED` yêu cầu assignment `COMPLETED` và order đang `INSTALLATION_IN_PROGRESS`; order đổi sang `COMPLETED` trong cùng transaction.
9. Terminal state không đổi.
10. Customer không thấy internal note.

## 6. Transaction

### Assign

- Lock appointment.
- Kiểm version/state.
- Lock hoặc kiểm technician.
- Insert assignment với range; PostgreSQL exclusion constraint là lớp bảo vệ cuối.
- Update appointment/version.
- Insert audit.
- Constraint conflict trả `409 TECHNICIAN_SCHEDULE_CONFLICT`.

### Reschedule

- Lock appointment.
- Lock slot cũ/mới theo ID tăng dần.
- Kiểm slot mới active/capacity.
- Decrement cũ nếu chưa release; increment mới.
- Cancel assignment cũ.
- Update appointment timestamps, slot, state, version.
- Audit và commit.

### Cancel

- Lock appointment và slot.
- Nếu chưa release: decrement `booked_count`, set `capacity_released_at`.
- Cancel assignment active.
- Set `CANCELLED`, tăng version.
- Không thực hiện hai lần.

## 7. Authorization

- CUSTOMER: own appointment, read; reschedule/cancel trước deadline và state được phép.
- STAFF: queue, assign/reschedule/cancel theo permission.
- TECHNICIAN: assigned-only read; accept/en-route/start/complete/report-issue.
- MANAGER/ADMIN: vận hành đầy đủ nhưng vẫn theo state machine.
- Tài nguyên ngoài ownership/assignment trả `404`.

## 8. Audit

Bắt buộc cho assign/reassign, reschedule/cancel nội bộ, capacity override và correction. Ghi actor, from/to, appointment/technician/slot ID, reason, request ID và before/after đã redact. Không ghi địa chỉ/phone đầy đủ.

## 9. Test bắt buộc

- Exhaustive transition allow/deny.
- Hai booking slot cuối: một thành công.
- Reschedule conflict giữ booking cũ.
- Release capacity đúng một lần.
- Assignment overlap bị từ chối ở DB.
- Technician khác không đọc/action.
- Start trước order ready bị từ chối.
- Complete đồng bộ order nguyên tử.
- Hai action cùng version: tối đa một thành công.
- Audit rollback cùng mutation.
- Terminal states không đổi.

## 10. Điểm cần con người duyệt

1. Nếu thay đổi lựa chọn khởi tạo `ASSIGNMENT_PENDING`, cần ADR và migration/transition tương thích dữ liệu cũ.
2. Deadline customer reschedule/cancel.
3. Có cho nhiều technician/appointment.
4. Quy tắc vùng/kỹ năng và thời gian di chuyển.
5. Checklist/bằng chứng hoàn tất.
6. Luồng no-show, customer unavailable và thất bại giữa thi công.
7. Capacity theo số job hay tổng duration.
8. Escalation khi hủy sau `EN_ROUTE`/`IN_PROGRESS`.
