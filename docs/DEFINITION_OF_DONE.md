# 247 Home — Definition of Done

## 1. Mục đích

Tài liệu quy định điều kiện bắt buộc để một task, vertical slice và toàn bộ MVP được xem là hoàn tất. “Code chạy trên máy người viết” không đủ.

Hiện tại dự án chỉ ở giai đoạn phân tích và thiết kế. Definition of Done cho giai đoạn hiện tại nằm tại mục 5.

## 2. Definition of Done cho task implementation

### Phạm vi và thiết kế

- [ ] Acceptance criteria của task được đáp ứng.
- [ ] Thay đổi nằm trong vertical slice và module đã duyệt.
- [ ] Không tự ý đổi stack hoặc thêm microservice.
- [ ] Quyết định kiến trúc mới có ADR khi cần.
- [ ] Không mở rộng scope ngầm.
- [ ] API, state machine và database design được cập nhật nếu contract đổi.

### Code quality

- [ ] TypeScript strict mode đạt.
- [ ] Không có `any`, trừ trường hợp có lý do rõ ràng bằng comment hoặc ADR.
- [ ] Không có dead code, debug code hoặc TODO P0 không có owner.
- [ ] Module boundary và dependency direction đúng `ARCHITECTURE.md`.
- [ ] Business rule nằm trong domain/application layer, không chỉ trong UI.
- [ ] Error được map sang contract chuẩn, không lộ stack hoặc SQL.
- [ ] Money dùng integer VND/`bigint`, không dùng floating point.
- [ ] Date-time lưu UTC và render theo timezone đã duyệt.

### Validation và authorization

- [ ] Mọi path, query, header nghiệp vụ và body không tin cậy được Zod validation tại server.
- [ ] Schema mutation strict; unknown security-sensitive field bị từ chối.
- [ ] Authentication kiểm tại server.
- [ ] Role/permission, ownership hoặc assignment kiểm tại server.
- [ ] UI/middleware không phải lớp authorization duy nhất.
- [ ] Negative authorization tests tồn tại.
- [ ] Resource ngoài scope trả lỗi không làm lộ sự tồn tại khi cần.

### Giá, tồn kho và transaction

- [ ] Client không quyết định giá, phí, line total hoặc grand total.
- [ ] Checkout tính lại giá từ dữ liệu server.
- [ ] Order lưu snapshot tiền và item chính xác.
- [ ] Inventory/slot/state mutation quan trọng dùng transaction.
- [ ] Lock order ổn định và constraint DB bảo vệ invariant.
- [ ] Idempotency và optimistic concurrency hoạt động ở endpoint liên quan.
- [ ] Side effect reserve/release/consume xảy ra đúng một lần.
- [ ] Concurrent tests chạy trên PostgreSQL thật.

### Database

- [ ] Thay đổi schema có migration được review.
- [ ] Migration chạy được trên DB sạch và DB ở phiên bản trước.
- [ ] Constraint, FK, unique, index và delete behavior phù hợp.
- [ ] Migration có rollback/forward-fix plan.
- [ ] Không xóa/reset database.
- [ ] Không chạy migration production.
- [ ] Không hard-delete dữ liệu lịch sử nếu chưa có policy.
- [ ] Prisma schema và migration SQL không mâu thuẫn.

### Audit và observability

- [ ] Mutation quản trị bắt buộc tạo audit log trong cùng transaction.
- [ ] Audit có actor, action, target, request ID, reason và before/after đã redact.
- [ ] Audit không chứa password, token, cookie, địa chỉ đầy đủ hoặc dữ liệu nhạy cảm không cần thiết.
- [ ] Application log có request/correlation ID.
- [ ] Log không chứa raw body nhạy cảm.
- [ ] Failure quan trọng có log/metric đủ điều tra mà không lộ PII.

### Security và privacy

- [ ] Threats liên quan trong `THREAT_MODEL.md` được xử lý hoặc có risk acceptance.
- [ ] Không có secret trong source, fixture, log hoặc artifact.
- [ ] Không thu thập/lưu thông tin thẻ.
- [ ] CSRF/origin protection áp dụng cho mutation dùng cookie.
- [ ] Output encoding, CSP và security headers phù hợp.
- [ ] Query/body/pagination/date range có giới hạn.
- [ ] Cache của dữ liệu authenticated là private/no-store phù hợp.
- [ ] Test dùng dữ liệu giả, không PII thật.
- [ ] Production dependency mới có giải thích và review supply-chain.

### UX và accessibility

- [ ] Loading, empty, success và error state được xử lý.
- [ ] Form lỗi giữ dữ liệu không nhạy cảm và focus vào lỗi hợp lý.
- [ ] Điều hướng bàn phím và focus visible.
- [ ] Label, error message và semantic markup phù hợp.
- [ ] Responsive từ 360 px cho luồng liên quan.
- [ ] Không chỉ dùng màu để truyền đạt trạng thái.
- [ ] Nội dung customer không lộ ghi chú nội bộ.

### Test và quality gate

- [ ] Unit tests cho rule/state/pricing liên quan.
- [ ] Integration tests với PostgreSQL cho repository, constraint và transaction.
- [ ] Authorization positive và negative tests.
- [ ] Concurrency tests nếu thay đổi inventory, slot, idempotency, assignment hoặc state transition.
- [ ] Playwright cho happy path P0 và failure quan trọng.
- [ ] Regression test được thêm khi sửa bug.
- [ ] Không sửa test để che lỗi behavior nếu requirement không đổi.
- [ ] Không skip test lỗi.
- [ ] Lint đạt.
- [ ] Typecheck đạt.
- [ ] Toàn bộ test suite liên quan và full suite theo CI đạt.
- [ ] Build đạt.

Lệnh chuẩn sẽ được chốt khi bootstrap `package.json`; baseline dự kiến:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

### Documentation và báo cáo

- [ ] README/runbook/API/schema/state docs được cập nhật.
- [ ] Acceptance evidence hoặc test name được liên kết.
- [ ] Sau task có danh sách file đã sửa.
- [ ] Sau task có lệnh test đã chạy và kết quả.
- [ ] Sau task có migration/rollback note.
- [ ] Sau task có rủi ro, giả định và việc còn lại.
- [ ] Không tuyên bố test đã chạy nếu chưa chạy.

## 3. Definition of Done cho vertical slice

Ngoài mọi mục task liên quan:

- [ ] Slice hoạt động end-to-end từ UI/API qua domain đến PostgreSQL.
- [ ] Toàn bộ acceptance criteria trong `IMPLEMENTATION_PLAN.md` đạt.
- [ ] Contract API và behavior UI thống nhất.
- [ ] Dữ liệu cũ vẫn đọc được hoặc có migration tương thích.
- [ ] Rollback đã được review; thao tác bù được định nghĩa cho dữ liệu nghiệp vụ.
- [ ] Feature chưa hoàn thiện không bị expose ngoài ý muốn.
- [ ] Security reviewer xem negative paths quan trọng.
- [ ] Product owner nghiệm thu luồng và copy.
- [ ] CI trên branch/PR đạt.
- [ ] Không có Critical/High defect chưa có quyết định chấp nhận bằng văn bản.

## 4. Definition of Done cho MVP nội bộ

### Product

- [ ] Catalog đủ năm nhóm MVP.
- [ ] Customer kiểm tra khu vực, quản lý cart/address, chọn slot và checkout.
- [ ] COD và chuyển khoản thủ công hoạt động đúng policy.
- [ ] Customer theo dõi order/installation và gửi warranty.
- [ ] Admin quản lý catalog, inventory, area, order, payment, technician, assignment, installation, warranty và audit.
- [ ] Technician chỉ xử lý công việc được phân công.
- [ ] Mọi P0 trong `PRODUCT_REQUIREMENTS.md` trace được đến test.

### Integrity và concurrency

- [ ] Price tampering không thay đổi tổng server.
- [ ] Không tạo order trùng khi replay/concurrent checkout.
- [ ] Không oversell SKU cuối.
- [ ] Không overbook slot cuối.
- [ ] Không assignment overlap.
- [ ] Cancel/reschedule/consume/release đúng một lần.
- [ ] State machine từ chối mọi transition ngoài bảng.
- [ ] Audit và mutation commit/rollback cùng nhau.

### Security

- [ ] RBAC/ownership/assignment matrix đạt.
- [ ] IDOR, CSRF, XSS, SQL injection và mass assignment tests đạt.
- [ ] Session/role revocation đạt.
- [ ] Secret scan sạch.
- [ ] Log/audit/artifact redaction được kiểm.
- [ ] Không có thông tin thẻ ở request schema, DB hoặc log.
- [ ] Threat model review hoàn tất.
- [ ] Không còn Critical/High risk chưa xử lý hoặc chưa được người có thẩm quyền chấp nhận.

### Quality và operations

- [ ] Full CI đạt trên clone sạch.
- [ ] Migration upgrade test đạt.
- [ ] Backup/restore local/test drill đạt.
- [ ] Query P0 đạt mục tiêu hiệu năng kiểm thử đã duyệt.
- [ ] Accessibility P0 đạt baseline WCAG 2.1 AA.
- [ ] Browser/responsive matrix đã duyệt đạt.
- [ ] Runbook local/test đủ để thành viên mới chạy.
- [ ] Không có production deployment workflow hoặc production credential.
- [ ] Không deploy production.

## 5. Definition of Done cho giai đoạn phân tích và thiết kế hiện tại

- [ ] Có đủ 12 file được yêu cầu:
  - `docs/PRODUCT_REQUIREMENTS.md`
  - `docs/USER_FLOWS.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DATABASE_DESIGN.md`
  - `docs/API_CONTRACT.md`
  - `docs/ORDER_STATE_MACHINE.md`
  - `docs/INSTALLATION_STATE_MACHINE.md`
  - `docs/THREAT_MODEL.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - `docs/DEFINITION_OF_DONE.md`
  - `AGENTS.md`
  - `README.md`
- [ ] Database design mô tả toàn bộ bảng tối thiểu được yêu cầu.
- [ ] Implementation plan chia vertical slices; mỗi slice có scope, files/modules, DB change, security, acceptance, tests và rollback.
- [ ] Role, state, API, bảng và money model không mâu thuẫn.
- [ ] MVP được chia thành phase nhỏ có dependency.
- [ ] Điểm mở cần con người duyệt được liệt kê.
- [ ] Không có source code ứng dụng.
- [ ] Không có `package.json`, lockfile, dependency hoặc thư mục cài đặt.
- [ ] Không migration hoặc database command nào được chạy.
- [ ] Không production deployment.
- [ ] Tài liệu được kiểm tra file/link/keyword và review chéo thủ công.

## 6. Điều kiện không được coi là Done

Task/slice chưa Done nếu xảy ra một trong các trường hợp:

- Chỉ ẩn nút ở client nhưng server không authorize.
- Tin giá, tổng, user ID, role hoặc state từ client.
- Test đang lỗi bị skip, xóa hoặc nới assertion không có requirement.
- Dùng `any` để né type error không có lý do.
- Migration không có rollback plan.
- Audit được ghi best-effort ngoài transaction cho mutation bắt buộc.
- Concurrency chỉ test tuần tự hoặc bằng DB khác PostgreSQL.
- Có known data corruption/security issue chưa xử lý.
- Có secret/PII thật trong repository hoặc artifact.
- Chưa chạy lint, typecheck, test và build.
- Tự ý cài dependency hoặc đổi stack.
- Xóa/reset DB, chạy production migration hoặc deploy production.
- Báo “đã test” nhưng không có lệnh/kết quả.

## 7. Quyền duyệt

| Nội dung | Người duyệt tối thiểu |
|---|---|
| Scope/acceptance | Product owner |
| Module/API/schema | Technical lead/architect |
| Migration/rollback | DB owner + technical reviewer |
| Auth/RBAC/threat controls | Security-capable reviewer |
| Financial/payment policy | Product/operations/finance |
| Privacy/retention | Product/legal/privacy owner |
| MVP acceptance nội bộ | Product + engineering + operations |

Một người có thể giữ nhiều vai trò trong nhóm nhỏ, nhưng quyết định và tên người chịu trách nhiệm phải được ghi.