# 247 Home — Product Requirements Document

## 1. Mục đích

247 Home là ứng dụng thương mại điện tử bán thiết bị nhà thông minh và an ninh gia đình, kèm dịch vụ lắp đặt tận nơi. MVP phải hỗ trợ toàn bộ hành trình từ khám phá sản phẩm, kiểm tra vùng phục vụ, đặt hàng và chọn lịch lắp đặt đến theo dõi thực hiện và gửi yêu cầu bảo hành.

Tài liệu này là nguồn yêu cầu sản phẩm cấp cao. Chi tiết kỹ thuật nằm trong các tài liệu cùng thư mục.

## 2. Mục tiêu MVP

- Cho phép khách mua thiết bị, combo và công lắp đặt trong một đơn hàng.
- Chỉ nhận lịch lắp đặt tại khu vực và khung giờ được hỗ trợ.
- Bảo đảm giá, tồn kho, quyền truy cập và trạng thái nghiệp vụ được kiểm soát tại server.
- Cho phép đội vận hành quản lý catalog, tồn kho, đơn hàng, lịch, kỹ thuật viên và bảo hành.
- Cung cấp audit log truy vết thao tác quản trị.
- Tạo nền tảng modular monolith có thể mở rộng sau MVP mà không cần microservices.

## 3. Ngoài phạm vi MVP

- Payment gateway, thu thập hoặc lưu thông tin thẻ.
- Thanh toán online tự động, hoàn tiền tự động hoặc đối soát ngân hàng tự động.
- Ứng dụng mobile native.
- Marketplace đa nhà bán.
- Nhiều kho, điều chuyển kho hoặc quản lý chuỗi cung ứng nâng cao.
- Định tuyến kỹ thuật viên tự động theo bản đồ.
- Chat thời gian thực.
- Loyalty, coupon, flash sale, review sản phẩm.
- Đa tiền tệ, đa ngôn ngữ.
- Deploy production.

## 4. Đối tượng sử dụng và vai trò

| Vai trò | Mục tiêu | Quyền chính |
|---|---|---|
| CUSTOMER | Mua hàng, theo dõi đơn/lịch, yêu cầu bảo hành | Quản lý dữ liệu và đơn của chính mình |
| STAFF | Vận hành catalog, đơn, lịch và bảo hành hằng ngày | Quyền nghiệp vụ được cấp, không quản trị tối cao |
| TECHNICIAN | Xem công việc được phân công, cập nhật tiến độ lắp đặt | Chỉ lịch được phân công và dữ liệu tối thiểu cần thiết |
| MANAGER | Giám sát vận hành, phân công, điều chỉnh nghiệp vụ | Quyền vận hành mở rộng và xem audit phù hợp |
| ADMIN | Quản trị hệ thống và phân quyền | Toàn quyền quản trị trong phạm vi ứng dụng |

Một người dùng có thể có nhiều role. Authorization luôn thực hiện tại server. Ma trận quyền chi tiết được duy trì trong `ARCHITECTURE.md` và từng API trong `API_CONTRACT.md`.

## 5. Phạm vi sản phẩm

### 5.1 Catalog

Nhóm sản phẩm MVP:

- Camera an ninh.
- Chuông cửa có hình.
- Wi-Fi mesh.
- Khóa cửa thông minh.
- Combo thiết bị kèm công lắp đặt.

Yêu cầu:

- Danh sách có phân loại, tìm kiếm cơ bản, lọc theo giá và khả năng lắp đặt.
- Trang chi tiết hiển thị mô tả, ảnh, biến thể, giá hiện hành, trạng thái còn hàng và gói dịch vụ tương thích.
- Biến thể đại diện cho SKU bán được; tồn kho quản lý ở cấp biến thể.
- Combo được mô hình hóa bằng `service_packages` trong MVP; thành phần và giá phải rõ ràng.
- Sản phẩm/biến thể ngừng bán không thể thêm mới vào giỏ, nhưng vẫn giữ snapshot trong đơn cũ.

### 5.2 Kiểm tra vùng phục vụ

- Khách nhập tỉnh/thành, quận/huyện và phường/xã hoặc mã bưu chính nếu có.
- Server chuẩn hóa và đối chiếu vùng phục vụ đang hoạt động.
- Kết quả cho biết có hỗ trợ lắp đặt hay không; không cam kết slot cho đến khi checkout.
- Địa chỉ được kiểm tra lại khi tạo đơn và khi đổi lịch.

### 5.3 Giỏ hàng và giá

- Giỏ hỗ trợ biến thể sản phẩm, gói dịch vụ và số lượng.
- Client chỉ gửi ID và số lượng; server tải giá hiện hành, tính lại từng dòng và tổng tiền.
- Giá hiển thị trong giỏ là tạm tính. Giá cuối cùng được chốt bằng snapshot khi tạo đơn.
- Tiền dùng VND, lưu dưới dạng số nguyên đồng; không dùng số thực.
- MVP chưa có coupon, thuế tách riêng hoặc phí vận chuyển động. Nếu có phí lắp đặt/giao hàng, server tính từ cấu hình gói/vùng phục vụ.
- Item không còn bán, thiếu tồn kho hoặc không tương thích phải chặn checkout với lỗi theo từng dòng.

### 5.4 Checkout

Khách phải:

1. Đăng nhập.
2. Chọn hoặc nhập địa chỉ giao hàng/lắp đặt.
3. Xác nhận khu vực được phục vụ nếu đơn có lắp đặt.
4. Chọn ngày và khung giờ còn khả dụng.
5. Chọn COD hoặc chuyển khoản thủ công.
6. Xem tổng tiền do server tính.
7. Xác nhận đặt hàng.

Yêu cầu:

- Tạo đơn và trừ/giữ tồn kho trong transaction an toàn đồng thời.
- Request tạo đơn hỗ trợ idempotency để tránh đơn trùng.
- Slot lắp đặt phải được kiểm tra và giữ trong cùng luồng nhất quán.
- Chuyển khoản chỉ cung cấp hướng dẫn và mã tham chiếu; STAFF/MANAGER xác nhận thủ công.
- Không lưu dữ liệu thẻ trong bất kỳ trường, log hoặc metadata nào.

### 5.5 Đơn hàng và thanh toán

- Khách xem danh sách và chi tiết đơn của mình.
- Chi tiết gồm snapshot sản phẩm, tiền, địa chỉ, phương thức/trạng thái thanh toán, trạng thái đơn và lịch sử trạng thái phù hợp.
- COD được ghi nhận `PENDING` khi đặt và `PAID` khi nhân viên xác nhận thu tiền.
- Chuyển khoản được ghi nhận `PENDING`; nhân viên xác nhận `PAID` hoặc đánh dấu `FAILED`.
- Hủy đơn tuân theo state machine và chính sách tồn kho.
- Không sửa trực tiếp tổng tiền của đơn đã tạo. Điều chỉnh ngoại lệ phải qua hành động nghiệp vụ có audit; MVP ưu tiên hủy và tạo lại.

### 5.6 Lắp đặt

- Chỉ hiển thị slot thuộc vùng phục vụ đang hoạt động và còn sức chứa.
- Quản lý lịch độc lập nhưng liên kết một-một với đơn cần lắp đặt trong MVP.
- STAFF/MANAGER phân công kỹ thuật viên đủ điều kiện và đang hoạt động.
- TECHNICIAN xem lịch được phân công, cập nhật các mốc cho phép.
- Khách theo dõi ngày, khung giờ, trạng thái và thông tin kỹ thuật viên tối thiểu.
- Đổi/hủy lịch phải kiểm tra quyền, trạng thái đơn, sức chứa slot và tạo audit log nếu do nhân sự vận hành thực hiện.

### 5.7 Bảo hành

- Khách gửi yêu cầu cho item thuộc đơn của mình.
- Server kiểm tra quyền sở hữu và điều kiện bảo hành theo snapshot/chính sách.
- Yêu cầu gồm loại vấn đề, mô tả và thông tin liên hệ; ảnh đính kèm nằm ngoài MVP trừ khi được duyệt ở phase sau.
- STAFF/MANAGER xử lý, cập nhật trạng thái và ghi chú nội bộ.
- Khách chỉ thấy nội dung dành cho khách, không thấy ghi chú nội bộ.

### 5.8 Admin

- Quản lý sản phẩm, biến thể, ảnh, giá, trạng thái bán và tồn kho.
- Quản lý gói dịch vụ/combo.
- Quản lý vùng phục vụ và sức chứa lịch.
- Tìm kiếm, xem và cập nhật đơn theo transition hợp lệ.
- Quản lý kỹ thuật viên và phân công.
- Quản lý yêu cầu bảo hành.
- Xem audit log theo quyền.
- Mọi mutation quản trị phải validation, authorization và audit tại server.

## 6. Quy tắc nghiệp vụ cốt lõi

### 6.1 Tiền tệ và giá

- Đơn vị duy nhất trong MVP: `VND`.
- Giá là integer không âm.
- `order_items.unit_price`, các thành phần giá và tổng đơn là snapshot bất biến sau khi đặt.
- Công thức chuẩn:
  - `line_total = unit_price * quantity`
  - `subtotal = sum(line_total)`
  - `installation_fee = server-calculated fee`
  - `shipping_fee = server-calculated fee`
  - `discount_total = 0` trong MVP
  - `grand_total = subtotal + installation_fee + shipping_fee - discount_total`
- Server không nhận hoặc tin `unit_price`, `line_total`, `grand_total` từ client.

### 6.2 Tồn kho

- `inventory.available = on_hand - reserved`, với invariant `on_hand >= 0`, `reserved >= 0`, `reserved <= on_hand`.
- Checkout khóa các bản ghi tồn kho theo thứ tự ID ổn định trong transaction, kiểm tra đủ hàng rồi tăng `reserved`.
- Đơn bị hủy trước khi xuất hàng giải phóng reservation đúng một lần.
- Khi đơn chuyển sang mốc hoàn tất xuất/ghi nhận bán theo quyết định vận hành, giảm `on_hand` và `reserved` nguyên tử.
- Mọi điều chỉnh thủ công yêu cầu lý do và audit log.

### 6.3 Slot lắp đặt

- Sức chứa được xác định theo vùng, ngày và khung giờ.
- Không vượt capacity dưới concurrent requests; kiểm tra và ghi nhận appointment trong transaction với khóa phù hợp.
- Một technician không được có assignment trùng thời gian đang hiệu lực.
- Mọi mốc thời gian lưu UTC; hiển thị theo `Asia/Ho_Chi_Minh`.

### 6.4 Dữ liệu và quyền riêng tư

- Thu thập dữ liệu tối thiểu cho giao hàng, lắp đặt, hỗ trợ và bảo hành.
- Password do cơ chế Auth.js/provider phù hợp xử lý; không log password/token.
- Địa chỉ và số điện thoại là dữ liệu nhạy cảm, chỉ hiện cho vai trò và ngữ cảnh cần thiết.
- Audit log không chứa secret, token, password hoặc payload nhạy cảm đầy đủ.

## 7. Yêu cầu chức năng theo mã

### Customer

- **CUS-01** Xem danh sách và chi tiết sản phẩm/combo đang bán.
- **CUS-02** Chọn biến thể và gói dịch vụ tương thích.
- **CUS-03** Kiểm tra vùng hỗ trợ lắp đặt.
- **CUS-04** Quản lý giỏ hàng.
- **CUS-05** Nhận báo giá tạm tính từ server.
- **CUS-06** Quản lý địa chỉ của mình.
- **CUS-07** Xem slot và chọn lịch lắp đặt.
- **CUS-08** Đặt đơn bằng COD hoặc chuyển khoản với idempotency.
- **CUS-09** Xem đơn và lịch của mình.
- **CUS-10** Gửi và theo dõi yêu cầu bảo hành của mình.

### Operations

- **OPS-01** Quản lý catalog, biến thể, ảnh, giá, trạng thái.
- **OPS-02** Quản lý và điều chỉnh tồn kho an toàn.
- **OPS-03** Quản lý gói dịch vụ/combo.
- **OPS-04** Quản lý vùng phục vụ và capacity slot.
- **OPS-05** Xử lý đơn qua transition hợp lệ.
- **OPS-06** Xác nhận thanh toán thủ công.
- **OPS-07** Quản lý kỹ thuật viên.
- **OPS-08** Phân công kỹ thuật viên không trùng lịch.
- **OPS-09** Quản lý lịch lắp đặt.
- **OPS-10** Xử lý bảo hành.
- **OPS-11** Xem audit log theo quyền.

### Platform

- **PLT-01** Authentication dùng Auth.js.
- **PLT-02** Authorization server-side theo role và ownership.
- **PLT-03** Validation server-side bằng Zod tại mọi trust boundary.
- **PLT-04** Audit mutation quản trị.
- **PLT-05** Structured logging có redaction và correlation ID.
- **PLT-06** Health/readiness dành cho local/test.
- **PLT-07** CI chạy lint, typecheck, unit/integration test, build và Playwright theo pipeline.

## 8. Yêu cầu phi chức năng

### Bảo mật

- Tuân theo `THREAT_MODEL.md`.
- Session cookie an toàn theo môi trường; chống CSRF cho mutation dựa trên cookie.
- Rate limit các endpoint nhạy cảm theo thiết kế có thể triển khai trong modular monolith.
- Không lộ resource tồn tại qua lỗi authorization khi có rủi ro IDOR.
- Header bảo mật và Content Security Policy được cấu hình trước khi release candidate.

### Nhất quán và độ tin cậy

- Transaction cho checkout, inventory reservation, slot capacity và state transition quan trọng.
- Unique constraint/idempotency key ngăn tạo đơn lặp.
- Transition phải kiểm tra optimistic concurrency hoặc version.
- Retry chỉ áp dụng lỗi tạm thời và không tạo side effect lặp.

### Hiệu năng mục tiêu cho môi trường kiểm thử chuẩn

- Trang catalog server response p95 dưới 800 ms khi DB có 10.000 biến thể.
- API đọc p95 dưới 500 ms; API mutation thông thường p95 dưới 1.000 ms, không tính dịch vụ ngoài.
- Checkout p95 dưới 2.000 ms trong tải MVP.
- Phân trang bắt buộc cho danh sách admin và audit log.
- Chỉ số là mục tiêu nghiệm thu trước release, không phải SLA production.

### Accessibility và UX

- Mục tiêu WCAG 2.1 AA cho luồng chính.
- Điều hướng bàn phím, focus rõ, label/error liên kết đúng.
- Form giữ dữ liệu không nhạy cảm khi validation lỗi.
- Trạng thái lỗi có hướng xử lý, không chỉ mã kỹ thuật.
- Responsive từ màn hình 360 px trở lên.

### Khả năng quan sát

- Log JSON có request/correlation ID, actor ID dạng định danh nội bộ và event name.
- Không log token, password, cookie, thông tin chuyển khoản đầy đủ hoặc địa chỉ đầy đủ.
- Audit log tách khỏi application log.
- Có metric logic cho checkout conflict, inventory shortage và slot conflict ở phase phù hợp.

### Backup và phục hồi cho local/staging tương lai

- Docker Compose dùng volume rõ ràng.
- Có hướng dẫn backup/restore môi trường phát triển trước khi thay đổi schema rủi ro.
- Không xóa/reset database tự động.

## 9. Chỉ số thành công MVP

Chỉ đo khi có môi trường thử nghiệm/người dùng pilot:

- Tỷ lệ hoàn tất checkout sau khi bắt đầu checkout.
- Tỷ lệ lỗi do hết tồn kho hoặc hết slot.
- Tỷ lệ đơn trùng: 0.
- Tỷ lệ overbooking tồn kho/slot: 0.
- Tỷ lệ lịch được phân công trước ngày hẹn.
- Thời gian trung vị xử lý yêu cầu bảo hành.
- Số lỗi authorization hoặc lộ dữ liệu: 0.
- Tỷ lệ test luồng P0 đạt: 100%.

Không đưa analytics bên thứ ba vào MVP nếu chưa duyệt quyền riêng tư.

## 10. Ưu tiên

### P0 — Bắt buộc

- Auth và RBAC/ownership.
- Catalog và vùng phục vụ.
- Giỏ và server pricing.
- Checkout COD/chuyển khoản thủ công.
- Inventory concurrency.
- Đơn hàng và state machine.
- Slot, appointment, technician assignment.
- Warranty cơ bản.
- Admin mutations có audit.
- Test và CI bắt buộc.

### P1 — Nên có nếu không ảnh hưởng P0

- Tìm kiếm admin nâng cao.
- Lịch sử trạng thái thân thiện hơn.
- Export vận hành có kiểm soát.
- Dashboard chỉ số cơ bản.
- Ảnh cho yêu cầu bảo hành sau khi có thiết kế lưu trữ an toàn.

### P2 — Sau MVP

- Payment gateway.
- Tự động định tuyến/phân công.
- Coupon, review, loyalty.
- Mobile app.
- Kiến trúc mở rộng ngoài modular monolith chỉ khi có dữ liệu chứng minh nhu cầu.

## 11. Giả định và phụ thuộc

- Một pháp nhân bán hàng, một currency và một timezone hiển thị.
- Một kho logic trong MVP.
- Một order có tối đa một installation appointment đang hiệu lực.
- Service package có thể gắn với variant hoặc combo định nghĩa trước.
- Capacity slot do vận hành cấu hình; không suy ra tự động từ số technician.
- Email/SMS provider chưa thuộc phạm vi; thông báo trong ứng dụng là đủ cho MVP.
- Auth provider cụ thể và chính sách xác minh tài khoản cần con người duyệt.
- Chính sách hủy, thời hạn bảo hành, phí giao hàng/lắp đặt và thời điểm ghi nhận bán cần chủ sản phẩm/pháp lý duyệt.

## 12. Tiêu chí chấp nhận cấp sản phẩm

MVP được xem là sẵn sàng cho nghiệm thu nội bộ khi:

- Toàn bộ P0 có acceptance test đạt.
- Hai request đồng thời không thể oversell cùng inventory hoặc overbook cùng slot.
- Client sửa giá/tổng tiền không ảnh hưởng số tiền lưu trong đơn.
- Người dùng không thể đọc/sửa tài nguyên của người khác.
- Technician không thể truy cập lịch chưa được phân công.
- Mọi mutation quản trị quan trọng tạo audit log.
- State machine đơn và lắp đặt không cho transition ngoài danh sách.
- Không có secret hoặc dữ liệu thẻ trong source, DB, log hay fixture.
- CI bắt buộc đạt theo `DEFINITION_OF_DONE.md`.

## 13. Vấn đề cần con người duyệt

1. Chính sách hủy đơn theo từng trạng thái và việc giải phóng tồn kho.
2. Thời điểm chuyển reservation thành hàng đã bán.
3. SLA và thời hạn đổi lịch/hủy lịch.
4. Capacity mỗi slot và quy tắc ngày nghỉ.
5. Phạm vi địa lý cùng cách chuẩn hóa địa chỉ Việt Nam.
6. Cấu trúc combo: bundle SKU cố định hay package dịch vụ gắn nhiều variant.
7. Công thức phí giao hàng và phí lắp đặt.
8. Thời hạn/điều kiện bảo hành theo nhóm sản phẩm.
9. Auth provider, xác minh email/điện thoại và quy trình khôi phục tài khoản.
10. Ai được gán role và quyền chi tiết giữa STAFF, MANAGER, ADMIN.
11. Thông tin chuyển khoản được phép hiển thị và quy trình xác nhận.
12. Chính sách lưu giữ/xóa dữ liệu cá nhân và audit log.