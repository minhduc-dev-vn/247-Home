# AGENTS.md — Quy tắc làm việc cho 247 Home

## 1. Phạm vi áp dụng

Quy tắc này áp dụng cho mọi người và coding agent thay đổi bất kỳ file nào trong repository 247 Home. Quy tắc ở đây bắt buộc, trừ khi con người có thẩm quyền ghi rõ ngoại lệ trong task hoặc ADR.

Thứ tự ưu tiên khi có xung đột:

1. Yêu cầu bảo mật và an toàn dữ liệu.
2. Yêu cầu task đã được con người duyệt.
3. `AGENTS.md`.
4. ADR đã accepted.
5. Tài liệu kiến trúc/sản phẩm còn lại.
6. Convention code hiện hữu.

Không tự suy diễn để bỏ qua quy tắc cấp cao hơn. Dừng và yêu cầu quyết định khi xung đột có thể gây mất dữ liệu, lộ dữ liệu, sai tiền hoặc sai quyền.

## 2. Stack cố định

Không tự ý thay đổi stack:

- Next.js với App Router.
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

Cấm:

- Đổi package manager.
- Đổi database hoặc ORM.
- Thêm framework backend riêng.
- Dùng Pages Router làm kiến trúc chính.
- Chuyển sang microservices.
- Thêm payment gateway thật trong MVP.
- Thêm production deployment/configuration nếu task không phải quyết định kiến trúc đã duyệt.

Nếu stack không đáp ứng requirement, viết ADR nêu vấn đề, lựa chọn, trade-off và migration impact. Không đổi trước khi được duyệt.

## 3. Dependency policy

Không thêm production dependency khi chưa giải thích.

Mỗi đề xuất dependency phải ghi:

- Vấn đề cần giải quyết.
- Vì sao API nền tảng hoặc dependency hiện có không đủ.
- Phương án không thêm dependency.
- Kích thước/phạm vi runtime.
- Security và supply-chain risk.
- License.
- Maintenance signal.
- Cách gỡ/rollback.

Quy tắc:

- Dùng `pnpm`; lockfile phải cập nhật cùng manifest.
- Không cài package global cho workflow dự án.
- Không thêm package trùng chức năng.
- Không chạy install tùy tiện nếu task chỉ sửa tài liệu.
- CI dùng frozen lockfile.
- Dependency update không được che test lỗi.
- GitHub Actions phải pin phiên bản đã review và dùng permission tối thiểu.

## 4. Database safety

Tuyệt đối không:

- Xóa database.
- Reset database.
- Chạy `prisma migrate reset`.
- Chạy `DROP DATABASE`.
- Xóa volume Docker chứa dữ liệu mà không có yêu cầu rõ và xác nhận.
- Chạy migration production.
- Kết nối production DB.
- Deploy production.
- Sửa trực tiếp dữ liệu lịch sử để “làm test pass”.

Mọi thay đổi database phải có:

- Prisma schema change.
- Migration được review.
- Mô tả forward compatibility.
- Rollback hoặc forward-fix plan.
- Tác động lock, downtime và backfill.
- Constraint/index/delete behavior.
- Test migration trên DB sạch và DB ở phiên bản trước.
- Backup note trước thay đổi destructive hoặc khó đảo ngược.

Ưu tiên migration expand/contract. Không drop/rename cột có dữ liệu trong cùng release nếu chưa có kế hoạch tương thích. Không xóa migration đã áp dụng; tạo migration bù.

Raw SQL chỉ dùng khi Prisma không biểu diễn an toàn, ví dụ row lock hoặc PostgreSQL exclusion constraint. Luôn parameterized, cô lập trong infrastructure adapter, có test PostgreSQL và review injection/lock order.

## 5. Kiến trúc và module boundary

- Giữ modular monolith.
- Module theo business capability, không gom toàn bộ logic vào `utils`, Route Handler hoặc component.
- Domain không phụ thuộc Next.js, Prisma, React hoặc HTTP.
- Application orchestration gọi domain và port.
- Infrastructure triển khai persistence/provider.
- Presentation chỉ parse/map/call use case.
- Cross-module mutation qua application API đã công bố.
- Không import Prisma model xuyên module làm contract.
- Không tạo distributed event bus, network call nội bộ hoặc service riêng.
- Transaction nhiều module phải có owner/orchestrator rõ.

Đọc `docs/ARCHITECTURE.md` trước thay đổi boundary.

## 6. TypeScript và code quality

- Luôn bật và giữ strict mode.
- Không dùng `any` trừ khi có lý do rõ ràng.
- Ngoại lệ `any` phải hẹp nhất, có comment nêu lý do và test boundary. Ưu tiên `unknown` + narrowing.
- Không dùng `@ts-ignore` để né lỗi. `@ts-expect-error` chỉ trong test hoặc compatibility case có lý do và phải bảo đảm lỗi thật sự tồn tại.
- Không non-null assertion nếu invariant chưa được chứng minh.
- Exhaustive switch cho enum/state quan trọng.
- Money không dùng `number` cho persistence/arithmetic; dùng `bigint` và decimal string tại JSON boundary.
- Không dùng floating point cho giá.
- Không hard-code role, state transition hoặc fee rải rác.
- Không duplicate validation/business rules giữa client và server; client validation chỉ UX.
- Không để debug log, commented-out code hoặc secret placeholder giống secret thật.

## 7. Validation tại server

Mọi API và server action phải validation tại server.

Bắt buộc validation:

- Path params.
- Query params.
- Request body.
- Header nghiệp vụ như `Idempotency-Key`.
- Environment variables.
- Dữ liệu JSON đọc từ DB/provider ngoài.
- Date/time, pagination, quantity và money range.

Dùng Zod schema strict cho mutation. Không nhận field mà use case không cần. Không dùng client schema làm bằng chứng duy nhất rằng server input an toàn. Actor ID, role, owner ID, price, total và state hiện tại phải lấy từ trusted server context/DB, không từ client.

## 8. Authentication và authorization

Mọi API phải authentication/authorization tại server theo yêu cầu endpoint.

- Auth.js xác định actor.
- Policy server kiểm role/permission.
- Repository hoặc use case kiểm ownership/active assignment.
- State machine kiểm transition.
- UI visibility và middleware chỉ là defense-in-depth.
- Deny mặc định.
- Không tin role/user ID từ body, query, cookie tự chế hoặc hidden field.
- Customer chỉ truy cập tài nguyên own.
- Technician chỉ truy cập appointment có active assignment.
- ADMIN không được bypass validation, state machine, money invariant hoặc audit.
- Resource ngoài scope nên trả `404` khi cần chống enumeration.
- Thêm endpoint phải có positive và negative authorization tests.

Đổi role phải xử lý session stale. Không cho gỡ ADMIN cuối cùng.

## 9. Giá và thanh toán

- Server luôn tính lại giá.
- Client không quyết định `unitPrice`, fee, line total, subtotal hoặc grand total.
- Checkout phải đọc catalog/package/area hiện tại trong transaction.
- Order item và tổng tiền là snapshot.
- VND lưu integer; JSON trả decimal string.
- Không sửa snapshot đơn để phản ánh giá catalog mới.
- Không tích hợp gateway thật trong MVP.
- Không nhận hoặc lưu PAN, CVV, expiry, card token hoặc credential ngân hàng.
- COD và chuyển khoản chỉ theo state/action đã thiết kế.
- Payment confirmation nội bộ có permission, reason và audit.

Mọi thay đổi pricing cần unit tests, tampering tests và review overflow/range.

## 10. Concurrency và transaction

Các luồng sau phải an toàn khi nhiều request đồng thời:

- Checkout/idempotency.
- Reserve/release/consume inventory.
- Book/release/reschedule slot.
- Technician assignment.
- State transition.
- Role ADMIN cuối.
- Default address/active cart nếu có invariant duy nhất.

Quy tắc:

- Dùng PostgreSQL transaction và constraint.
- Lock resource theo thứ tự ID ổn định.
- Dùng `SELECT ... FOR UPDATE` hoặc conditional update phù hợp.
- Dùng `expectedVersion` cho mutable aggregate.
- Side effect phải exactly-once theo lifecycle marker.
- Không gọi network trong transaction.
- Không retry business conflict.
- Retry deadlock/serialization failure có giới hạn và idempotent.
- Concurrent test phải dùng PostgreSQL thật, không SQLite/mock-only.

## 11. Audit và logging

Mọi thao tác quản trị quan trọng phải audit, gồm tối thiểu:

- Role assignment/removal.
- Catalog/price/status mutation.
- Inventory adjustment.
- Service area/slot capacity mutation.
- Order/payment transition.
- Technician create/status/assignment.
- Installation reschedule/cancel/exception.
- Warranty transition.
- Security-sensitive config nếu được thêm.

Audit bắt buộc:

- Ghi trong cùng transaction với mutation.
- Có actor, action, target, request ID, reason và before/after đã redact.
- Append-only qua application API; không cung cấp update/delete.
- Rollback mutation nếu audit bắt buộc ghi thất bại.

Không log:

- Password.
- Session token.
- Access/refresh/verification token.
- Cookie hoặc Authorization header.
- Secret/environment value.
- Thông tin thẻ.
- Raw request body chứa PII.
- Địa chỉ hoặc số điện thoại đầy đủ nếu không thật sự cần.
- Warranty internal/customer text đầy đủ vào application log.

Dùng structured logging và allowlist field. Không dùng `console.log` cho dữ liệu nghiệp vụ.

## 12. Security và privacy

- Đọc threat model khi thay đổi trust boundary.
- Chống CSRF/origin abuse cho mutation dựa trên cookie.
- Không dùng `dangerouslySetInnerHTML` nếu chưa có sanitizer và threat review.
- Plain text là baseline cho nội dung do người dùng nhập.
- Không server-fetch URL tùy ý.
- Giới hạn body, array, string, pagination và date range.
- Dữ liệu authenticated dùng cache private/no-store phù hợp.
- Error response không lộ stack, SQL hoặc resource existence không cần thiết.
- Test/seed dùng dữ liệu giả.
- Không commit DB dump chứa dữ liệu thật.
- Upload, provider ngoài, analytics hoặc telemetry mới cần privacy/security review.

Không để secret trong source code. Nếu phát hiện secret:

1. Không sao chép secret vào issue/log/chat.
2. Báo ngay.
3. Xem secret là đã lộ và rotate qua owner.
4. Xóa khỏi history theo quy trình được duyệt.
5. Thêm kiểm soát ngăn tái diễn.

## 13. Testing

Sau mọi thay đổi implementation, luôn chạy:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Nếu repository tách command khác, dùng command canonical trong `package.json`/README và vẫn phải bao phủ lint, typecheck, test và build.

Quy tắc:

- Không bỏ qua test đang lỗi.
- Không dùng `.skip`, `.only`, quarantine hoặc nới assertion để che regression.
- Nếu test có lỗi từ trước, ghi nhận và sửa hoặc dừng; không tuyên bố task Done.
- Bug fix phải có regression test.
- API mutation phải có validation và authorization tests.
- Inventory/slot/state/idempotency phải có concurrency tests.
- Constraint/transaction test dùng PostgreSQL.
- Luồng P0 có Playwright.
- Không báo test đã chạy nếu chưa chạy.
- Task chỉ tài liệu: không cần chạy app test/build khi chưa có app/dependency; phải chạy kiểm tra tài liệu/file phù hợp và nói rõ.

## 14. Git và thay đổi file

- Chỉ sửa file cần thiết.
- Không format/rewrite file không liên quan.
- Không xóa file hoặc history nếu task không yêu cầu.
- Không commit generated secret, logs, videos, traces, DB volumes hoặc `node_modules`.
- Không force push/rebase shared branch nếu chưa được yêu cầu.
- Không sửa migration đã áp dụng.
- Không chạy command phá hủy hoặc khó đảo ngược mà không có xác nhận.
- Giữ commit/slice nhỏ, reviewable và có lý do.

## 15. Quy trình mỗi task

### Trước khi sửa

1. Đọc task và acceptance criteria.
2. Đọc tài liệu/module liên quan.
3. Xác định trust boundary, quyền và dữ liệu nhạy cảm.
4. Xác định migration, transaction, audit và rollback impact.
5. Giải thích dependency mới nếu có.
6. Hỏi con người nếu quyết định mở chặn tính đúng đắn/an toàn.

### Trong khi sửa

1. Thực hiện vertical slice nhỏ nhất.
2. Validation/authorization trước side effect.
3. Giữ business invariant trong domain/DB.
4. Viết test cùng thay đổi.
5. Cập nhật tài liệu/ADR/contract.
6. Không mở rộng scope ngầm.

### Sau mỗi task

Bắt buộc liệt kê:

- File đã sửa.
- Migration/database action đã thực hiện.
- Test/lint/typecheck/build đã chạy, kèm kết quả.
- Test không chạy và lý do.
- Rủi ro còn lại.
- Giả định/điểm cần con người duyệt.
- Rollback plan.

Mẫu báo cáo:

```text
Files changed:
- path/to/file

Database:
- Migration: ...
- Commands run: ...
- Rollback: ...

Verification:
- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS
- `pnpm test:integration`: PASS
- `pnpm test:e2e`: PASS
- `pnpm build`: PASS

Remaining risks:
- ...

Human review:
- ...
```

Không ghi `PASS` nếu command không được chạy hoặc output không xác nhận thành công.

## 16. Lệnh bị cấm mặc định

Không chạy nếu chưa có chỉ thị rõ, phạm vi đúng và xác nhận rủi ro:

```text
prisma migrate reset
prisma db push --force-reset
DROP DATABASE
DROP SCHEMA ... CASCADE
docker compose down -v
rm -rf trên dữ liệu/repository
git reset --hard
git clean -fdx
git push --force
production migration command
production deploy command
```

Danh sách không đầy đủ. Mọi command có thể xóa dữ liệu, ghi đè history, rotate secret, thay hệ thống hoặc deploy đều cần xử lý như thao tác nguy hiểm.

## 17. Điều kiện dừng và yêu cầu con người quyết định

Dừng trước khi thay đổi nếu:

- Requirement mâu thuẫn state machine/schema/API.
- Có nguy cơ mất dữ liệu.
- Cần production access/deploy/migration.
- Cần thu thập thông tin thẻ.
- Cần thêm microservice hoặc đổi stack.
- Policy tiền, hủy, bảo hành hoặc quyền chưa đủ để bảo đảm đúng.
- Migration rollback không xác định.
- Security Critical/High không có mitigation.
- Test lỗi nhưng nguyên nhân nằm ngoài scope và không thể xác minh an toàn.

Không tự chọn phương án thuận tiện khi có thể ảnh hưởng tiền, quyền, tồn kho, lịch hoặc dữ liệu cá nhân.