# Operations Completion Review

Ngày review: 2026-07-14 (Asia/Bangkok)

Phạm vi review: toàn bộ implementation Operations hiện tại, state machine, Prisma schema/migrations, API contract, Admin UI, Technician UI, fixtures, unit/integration/E2E tests và full quality gates sau migration cuối.

## Kết luận

**OPERATIONS DONE (có residual risks Medium/Low được theo dõi)**

Không còn Critical hoặc High finding. Sau `pnpm db:migrate`, full E2E mới ngày
2026-07-14 pass 12/12, không retry; lint, typecheck, unit, integration và build
đều pass.

H-01 đến H-04 và M-01 đến M-06 đã được khắc phục, có test thực tế. Các residual
risks Low ngoài phạm vi remediation vẫn được giữ ở phần Findings.

Admin UI và Technician UI đều đã có mutation controls, không còn read-only. Đây là điều kiện cần nhưng chưa đủ để đạt Definition of Done.

## Requirement Matrix

| Requirement | Trạng thái | Implementation evidence | Test evidence / gap |
|---|---|---|---|
| Có trạng thái `ARRIVED` riêng | PASS | `prisma/schema.prisma:74-84`, `src/modules/operations/domain/installation-transition.ts:61-69`, migration `20260713190000...:1-3` | `tests/unit/operations-transition.test.ts:19-33` |
| Không bỏ qua `ARRIVED` | PASS | `EN_ROUTE -> ARRIVED -> IN_PROGRESS` tại `installation-transition.ts:65-68`; timestamp DB check tại migration `20260713190000...:27-35` | Unit reject skip tại `operations-transition.test.ts:47-65`; E2E direct invalid start tại `operations-technician-workflow.spec.ts:29-55` |
| Order và appointment đổi nguyên tử khi technician start/complete | PASS cho technician workflow | Cùng `prisma.$transaction` tại `operations-service.ts:638-737`; order update có guard status tại `664-693`; appointment guard version/status tại `694-702` | Integration start/complete/audit tại `operations.test.ts:227-296` |
| Không update order chỉ theo `id` | **PASS (H-01 resolved 2026-07-14)** | Row lock tại `order-repository.ts`; conditional `updateMany` theo `id + version + status + inventoryStatus`, yêu cầu `count === 1` tại `commerce-service.ts:640-725` | PostgreSQL concurrency regression tại `tests/integration/order-transitions.test.ts` |
| Order transition có side effect theo state machine | **PASS (H-02 resolved 2026-07-14)** | Policy duy nhất tại `order-transition.ts`; consume inventory, conditional order update và audit trong một transaction tại `commerce-service.ts:640-810` | Unit policy và PostgreSQL transaction/rollback tests tại `order-transition.test.ts`, `order-transitions.test.ts` |
| Appointment action có concurrency protection | PASS | `expectedVersion` + conditional `updateMany` tại `operations-service.ts:648-702` | E2E gửi hai `en-route` đồng thời cùng version: đúng một 200, một 409, state/version/audit được kiểm tại `operations-technician-workflow.spec.ts` |
| Chỉ Manager/Admin assign/reschedule | PASS | `requireManagement` tại `operations-service.ts:45-49`, gọi tại `267` và `354`; server routes gọi application service | Integration STAFF deny `operations.test.ts:94-107`; E2E STAFF deny API/UI `operations-staff-ui.spec.ts` |
| Technician chỉ xem/action assignment của mình | PASS | Scope `technician.userId` tại `operations-service.ts:443-469`, `503-515`, `548-556`, `639-647` | Integration denial `operations.test.ts:109-128`; E2E IDOR `operations-idor.spec.ts` |
| Direct API bị chặn | PASS | Route handlers lấy actor server-side và gọi scoped service | E2E direct action/detail denial trả 404 tại `operations-idor.spec.ts:19-40` |
| Không privilege escalation qua Operations | PASS trong phạm vi module | Không có role mutation trong Operations; management action vẫn kiểm role server-side | STAFF negative test ở integration và E2E |
| PostgreSQL exclusion constraint hoạt động | PASS | `btree_gist` và `technician_assignments_no_active_overlap` tại migration `20260713173000...:1-8` | Integration thực sự insert overlap và nhận `23P01` tại `operations.test.ts:212-224` |
| Concurrent slot reservation/reschedule | PASS | Conditional `bookedCount < capacity` update tại `operations-service.ts:383-391`; transaction rollback giữ slot cũ | PostgreSQL concurrency test `operations.test.ts:175-210` |
| Concurrent assignment được map đúng thành conflict | PASS | Exclusion violation `23P01`/Prisma error được map thành `CONFLICT` tại `operations-service.ts` | PostgreSQL application race assignment: đúng một success, một conflict, một audit tại `operations.test.ts` |
| Migration an toàn trên database phiên bản trước | **PASS (H-03 resolved 2026-07-14)** | Giữ nguyên checksum migration cũ; forward fix `20260714110000...` backfill theo timestamp sớm nhất, reject mâu thuẫn, add `NOT VALID` rồi `VALIDATE` | `pnpm test:migration` replay migration thật đến `20260713173000`; valid upgrade và invalid rollback đều PASS trên PostgreSQL 16 |
| Có rollback notes | PASS | `docs/OPERATIONS_MIGRATION_RUNBOOK.md` và `ROLLBACK.md` trong từng migration Operations | Bao phủ applied/not-run/partially-failed, post-check và forward-only recovery |
| Không có query danh sách không giới hạn | PASS | Candidate technician dùng cursor, default 25, max 100, stable name/id ordering và search tại `operations-service.ts` | Unit schema limit; integration pagination/filter/order; UI có tải thêm trang |
| Evidence chống path traversal | PASS | Filename basename/slash check và generated storage key tại `local-evidence-storage.ts:46-53`, `56-105` | Unit traversal test `operations-evidence-storage.test.ts:43-55` |
| Evidence MIME, extension, signature, size | PASS | `local-evidence-storage.ts:13-29`, `67-93`; Zod body bound tại `schemas.ts:48-54` | Technician workflow E2E upload ảnh hợp lệ PASS trong run 2026-07-14 |
| Evidence preview có authorization | PASS/PARTIAL TEST | Role/owner check tại `operations-service.ts:606-627`; API không trả storage key/path | Integration manager allow/customer deny tại `operations.test.ts:410-429`; chưa có direct unrelated-technician preview test |
| Evidence cleanup trên DB/filesystem failure | PASS cho paths đã test | Staging/finalize/compensate/discard tại `local-evidence-storage.ts:148-170` | Unit DB failure và integration DB/filesystem failure, kể cả browser-close cleanup failure, tại `operations.test.ts:431-550` |
| Admin detail/status/assignment/reschedule/warranty/audit | PASS về implementation | `src/components/operations/operations-console.tsx`; server policy/action endpoints tương ứng | Assignment/reschedule/STAFF E2E tồn tại; order status action chưa có E2E/integration guard test |
| Admin pagination/filter/loading/error/empty | PASS về implementation | `usePagedResource` và các queue tại `operations-console.tsx:200-262`, `388-407`; list APIs dùng bounded cursor trừ candidate technician | Warranty/audit pagination integration tại `operations.test.ts:363-408`; chưa có Admin pagination E2E |
| Technician own list/filter/pagination/detail | PASS về implementation | `operations-service.ts:438-488`; `technician-console.tsx` | `technician-jobs.spec.ts` và `operations-idor.spec.ts` |
| Technician en-route/arrived/start/complete/notes/evidence | PASS về implementation | Server action options tại `operations-service.ts:490-535`; mutation tại `629-737`; UI controls tại `technician-console.tsx` | Workflow E2E PASS trong run 2026-07-14 |
| Full gates sau migration cuối | **PASS** | `pnpm db:migrate` xác nhận 8 migrations up to date trước gates | format/lint/typecheck/unit/integration/E2E/build đều PASS; E2E 13/13 |

## Requirement To Test Traceability

| Test bắt buộc | File/test | Kết quả review |
|---|---|---|
| E2E Manager/Admin assignment | `tests/e2e/operations-assignment.spec.ts` | PASS; fixture row được tìm qua pagination thực tế |
| E2E technician completion | `tests/e2e/operations-technician-workflow.spec.ts` | PASS; full `ASSIGNED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED`, notes, evidence preview, order và audit |
| E2E cross-technician denial | `tests/e2e/operations-idor.spec.ts` | Tồn tại; PASS |
| E2E reschedule conflict | `tests/e2e/operations-reschedule.spec.ts` | PASS; conflict giữ nguyên appointment cũ |
| Integration assignment + audit | `tests/integration/operations.test.ts:61-92` | Tồn tại; PASS |
| Integration STAFF assignment denial | `tests/integration/operations.test.ts:94-107` | Tồn tại; PASS |
| Integration reschedule + rollback + audit | `tests/integration/operations.test.ts:130-173` | Tồn tại; PASS |
| Integration concurrent final slot | `tests/integration/operations.test.ts:175-210` | Tồn tại; PASS trên PostgreSQL |
| Integration exclusion constraint | `tests/integration/operations.test.ts:212-224` | Tồn tại; PASS trên PostgreSQL |
| Integration technician start/complete audit | `tests/integration/operations.test.ts:227-296` | Tồn tại; PASS |
| Integration suitable technician filtering | `tests/integration/operations.test.ts:298-324` | Tồn tại; PASS |
| Integration pagination | `tests/integration/operations.test.ts:326-408` | Tồn tại cho technician/warranty/audit; PASS |
| Integration evidence authorization/cleanup | `tests/integration/operations.test.ts:410-550` | PASS; gồm cleanup độc lập khi mô phỏng browser close failure |
| Order state guard tests | `tests/unit/order-transition.test.ts`, `tests/integration/order-transitions.test.ts` | PASS; gồm policy, concurrent version, inventory lifecycle, payment và rollback |
| Migration upgrade từ version trước | `scripts/test-operations-migration-upgrade.ts`, `tests/migration/*.sql` | PASS; 5 progressed assignments, constraint validation, no data loss, invalid history rejection/rollback |
| Concurrent assignment qua application service | `tests/integration/operations.test.ts` | PASS; PostgreSQL exclusion race trả một success và một `CONFLICT` |
| Hai technician action cùng expectedVersion | `tests/e2e/operations-technician-workflow.spec.ts` | PASS; hai POST `en-route` cùng expectedVersion trả đúng một 200 và một 409; audit không trùng |

Không tìm thấy `.skip`, `.only`, `test.fixme` hoặc `waitForTimeout` trong test hiện tại.

## Findings

### Critical

Không phát hiện Critical finding trong phạm vi review này.

### High

#### H-01 — RESOLVED 2026-07-14 — Admin order transition bị lost update

- Fix: `src/modules/commerce/application/commerce-service.ts:640-725` và `src/modules/commerce/infrastructure/order-repository.ts`.
- Transaction khóa order, kiểm `expectedVersion`, rồi conditional `updateMany` theo `id + version + current status + inventoryStatus`; `count !== 1` trả `CONCURRENT_MODIFICATION`/HTTP 409.
- PostgreSQL concurrency test xác minh hai request cùng version trả đúng một HTTP 200 và một HTTP 409, version chỉ tăng một và chỉ có một audit event.
- Success response dùng DTO JSON-safe; regression test đã phát hiện và loại bỏ trường Prisma `BigInt` từng làm response thành công trả 500 sau commit.

#### H-02 — RESOLVED 2026-07-14 — Order action bỏ qua side effect inventory/state guard

- Fix: policy server-side duy nhất tại `src/modules/commerce/domain/order-transition.ts`; transaction implementation tại `commerce-service.ts:640-810`.
- `mark-ready-for-installation` khóa inventory theo variant ID ổn định, xác minh toàn bộ reservation trước write, chuyển order `RESERVED -> CONSUMED`, giảm `onHand/reserved`, tăng version và ghi audit trong một transaction.
- Retry bằng stale version không consume/audit lần hai. Thiếu reservation hoặc PostgreSQL từ chối inventory update sẽ rollback inventory, order và audit.
- `complete-without-installation` yêu cầu `READY_FOR_INSTALLATION`, inventory `CONSUMED`, không có appointment và payment `PAID`.
- Test: `tests/unit/order-transition.test.ts`, `tests/integration/order-transitions.test.ts`, `tests/unit/api-handler.test.ts`.

#### H-03 — RESOLVED 2026-07-14 — Migration upgrade có thể fail với assignment đã tiến triển

- Migration cũ đã được áp dụng local và checksum trong database khớp file `5c02b797...a0cfb`, nên không chỉnh sửa lịch sử.
- Forward migration: `prisma/migrations/20260714110000_operations_assignment_timestamp_forward_fix/migration.sql`.
- `assigned_at` được backfill bằng timestamp đáng tin cậy sớm nhất; known lifecycle timestamps không bị dịch chuyển hoặc xóa. Legacy `started_at` không có ARRIVED dùng `arrived_at = started_at`, giữ đúng boundary cũ mà không tạo duration giả.
- Chuỗi timestamp mâu thuẫn fail rõ bằng `OPERATIONS_TIMESTAMP_HISTORY_INVALID`; explicit transaction rollback toàn bộ schema/data change.
- Constraint được add `NOT VALID` rồi `VALIDATE`; local post-check xác nhận `convalidated = true`, `invalid_rows = 0`.
- Upgrade harness replay sáu migration thật đến version trước trên PostgreSQL 16 `tmpfs`, kiểm ASSIGNED/EN_ROUTE/ARRIVED/IN_PROGRESS/COMPLETED, không mất row/known timestamp và kiểm invalid history rollback.
- Recovery cho database chưa chạy hoặc đã fail migration cũ được ghi tại `docs/OPERATIONS_MIGRATION_RUNBOOK.md`; không reset/drop/truncate hoặc sửa checksum.

#### H-04 — RESOLVED 2026-07-14 — Mandatory E2E không ổn định với fixture ngoài page đầu

- Fix: `tests/e2e/operations.helpers.ts` chờ đúng filtered appointment response rồi duyệt cursor pagination bằng locator thực tế; không dùng `waitForTimeout` hay retry.
- `operations-assignment.spec.ts`, `operations-reschedule.spec.ts` và `operations-staff-ui.spec.ts` dùng helper này, không còn phụ thuộc page đầu hay dữ liệu fixture cũ.
- Full run sau `pnpm db:migrate`: 12/12 PASS.

### Medium

#### M-01 — RESOLVED 2026-07-14 — Fixture cleanup không failure-safe

- Fix: `runFailureSafeCleanup` tại `tests/fixtures/operations.ts` chạy từng cleanup step độc lập, thu thập lỗi và throw `AggregateError` sau khi mọi step đã được thử.
- `withOperationsE2eFixture` tại `tests/e2e/operations.helpers.ts` luôn đóng từng browser context rồi cleanup fixture namespace, kể cả khi assertion/action/upload fail.
- `cleanupOperationsFixtureNamespace` chỉ xóa rows/evidence thuộc namespace hợp lệ `ops<32 hex>`; `pnpm cleanup:operations-fixtures <namespace>` là command chủ động cho residue cũ.
- Integration `operations.test.ts` mô phỏng browser close failure và xác nhận user/order rows cùng evidence file đã bị cleanup.

#### M-02 — RESOLVED 2026-07-14 — Candidate technician query không có giới hạn

- Candidate API nhận `cursor`, `limit` default 25/max 100 và `search`; response là `{ items, nextCursor }` với sort `user.name, id` ổn định.
- Server vẫn lọc active user/profile, service area và conflict schedule; integration kiểm từng điều kiện, pagination và ordering.
- Assignment dialog hỗ trợ tải thêm kỹ thuật viên khi còn `nextCursor`.

#### M-03 — RESOLVED 2026-07-14 — Security contract chưa tập trung cho Operations mutations

- `withOperationsJsonMutation` kiểm allowed origin, `application/json`, body size và in-memory rate limit trước Zod/use case; POST assign, reschedule, order action, technician action và evidence đều dùng wrapper này.
- Normal action body giới hạn 64 KiB; evidence JSON base64 có limit 8 MiB. Lỗi có envelope `403/413/415/429`, `Retry-After` cho rate limit và `Cache-Control: private, no-store`.
- Unit negative tests xác nhận origin sai, content type sai, body quá lớn và rate limit không gọi mutation. E2E Operations xác nhận browser/local origin hợp lệ không bị phá.

#### M-04 — RESOLVED 2026-07-14 — Concurrency test coverage

- `tests/integration/order-transitions.test.ts` kiểm hai `transitionOrder` cùng version.
- `tests/integration/operations.test.ts` kiểm hai `assignTechnician` cạnh tranh trên cùng technician/time: một success, một `CONFLICT`, một appointment/version/audit effect. PostgreSQL exclusion `23P01` và deadlock rollback `40P01` đều được chuẩn hóa thành conflict, không tạo side effect thứ hai.
- Cùng test kiểm hai `technicianAction` `en-route` cùng expectedVersion: một success, một conflict, version tăng một và audit không trùng.

#### M-05 — RESOLVED 2026-07-14 — Authenticated Operations response cache headers

- Candidate technician, warranty list, audit list và technician assignment detail đều trả `Cache-Control: private, no-store`.
- E2E `operations-cache-headers.spec.ts` gọi endpoint thật bằng Manager/Technician session và kiểm header từng route.

#### M-06 — RESOLVED 2026-07-14 — Money display chuyển decimal string sang `number`

- `formatVnd` format trực tiếp từ string hoặc bigint integer, không qua JavaScript `Number`.
- Unit test kiểm `9007199254740993` và bigint lớn hơn `MAX_SAFE_INTEGER` vẫn hiển thị chính xác.

### Low

#### L-01 — API ID/cursor documentation không thống nhất

- `docs/API_CONTRACT.md:12-15` mô tả UUID và cursor opaque.
- Operations schemas dùng CUID và API trả raw record ID làm cursor tại `operations-service.ts:34-37`.
- Behavior hiện nhất quán trong code/test nhưng contract tổng quát cần được sửa hoặc implementation cần adapter cursor opaque.

#### L-02 — Evidence compensation vẫn có residual distributed-storage risk

- File: `local-evidence-storage.ts:159-169`.
- Nếu filesystem finalize fail và callback compensate cũng fail do DB unavailable, file được discard nhưng DB evidence row có thể còn lại.
- Các error paths hiện được test đều pass; chưa có reconciliation job/test cho double failure này. Local/mock storage chỉ dành development/test nên severity Low.

#### L-03 — Warranty detail UI không có error handling riêng

- File: `src/components/operations/operations-console.tsx:796-801`.
- Promise mở detail chỉ `.then(setWarrantyDetail)` và không có loading/error handling cho dialog; list queue vẫn có đầy đủ loading/error/empty.

#### L-04 — Operations rate limit hiện là in-memory theo process

- `src/modules/identity/infrastructure/rate-limiter.ts` phù hợp local/test và single-process MVP, nhưng không chia sẻ quota giữa nhiều application instance.
- Khi có deployment đa instance, cần thay bằng shared rate-limit store đã được duyệt; không thêm dependency trong remediation này vì project chưa deploy.

## Commands And Results

Các command dưới đây chạy trên repository hiện tại, sau migration command cuối và không dùng kết quả từ lượt trước:

| Command | Kết quả |
|---|---|
| `pnpm db:up` | PASS — PostgreSQL container `247-home-db` running |
| `pnpm db:migrate` | PASS — forward fix applied; 8 migrations, schema up to date |
| `pnpm format:check` | PASS — all matched files use Prettier code style |
| `pnpm lint` | PASS — exit 0, zero warnings allowed |
| `pnpm typecheck` | PASS — exit 0 |
| `pnpm test` | PASS — 11 files, 38 tests |
| `pnpm test:integration` | PASS — 6 files, 38 tests, PostgreSQL thật |
| `pnpm test:migration` | PASS — valid legacy upgrade; invalid history rejection và transaction rollback trên PostgreSQL 16 |
| `pnpm test:e2e` | PASS — 13 passed, chạy mới từ Playwright server sau `pnpm db:migrate`, không retry |
| `pnpm build` | PASS — Next.js production build completed |

Additional read-only/diagnostic checks:

- Dừng đúng repository dev server ở port 3000 trước E2E; Playwright khởi động server mới từ code hiện tại.
- PostgreSQL regression order race sau fix: đúng `1 fulfilled + 1 rejected(CONCURRENT_MODIFICATION)`, `status = CONFIRMED`, version tăng đúng `1`, `auditCount = 1`; fixture đã cleanup.
- Fixture residue query sau full E2E: không có namespace mới; còn 6 namespace cũ từ run thất bại trước, không tự xóa để làm báo cáo trông sạch hơn. Dùng `pnpm cleanup:operations-fixtures <namespace>` sau khi người vận hành xác nhận namespace. Checkout fixture không để lại slot test.
- Workspace không có `.git`, nên không thể xác định branch name hoặc đối chiếu Git diff; review dựa trên toàn bộ source hiện tại.

## Manual Verification Còn Cần

1. Diễn tập runbook H-03 trên staging snapshot có kích thước gần production, đo thời gian table lock/constraint scan và xác nhận backup restore procedure trước production deploy.
2. Đăng nhập technician B và gọi trực tiếp evidence preview của technician A; xác nhận 404 và không lộ metadata/path.
3. Kiểm tra Admin/Technician UI bằng bàn phím và viewport 360 px; review focus/error announcements cho dialog/action conflicts.
4. Kiểm tra Admin pagination với nhiều hơn 10 orders, appointments, warranties và audit events.

## Database And Rollback Notes

- Review không chạy reset/drop database và không sửa dữ liệu lịch sử.
- Không tạo migration mới trong lượt review.
- Forward migration H-03 đã deploy local; migration upgrade test riêng replay version trước trên PostgreSQL 16 và không kết nối application database.
- H-01/H-02 không tạo migration. Rollback application cần hoàn tác đồng thời policy, conditional transition và inventory consumption; không rollback riêng một phần vì sẽ phá lifecycle contract.
- Dữ liệu đã `CONSUMED` không được đổi ngược thủ công khi rollback deployment; cần forward-fix/reconciliation có audit nếu phát hiện dữ liệu bất thường.
- Residual risk: schema hiện lưu reservation dưới dạng counter theo variant, không có reservation row riêng cho từng order item; invariant dựa đồng thời vào `orders.inventoryStatus` và counter đã khóa.
- Migration H-03 dùng forward-only strategy. Migration cũ giữ nguyên checksum; recovery cho not-run/failed/partial deploy nằm trong `docs/OPERATIONS_MIGRATION_RUNBOOK.md`.
- File duy nhất được thêm trong lượt review là báo cáo này. Rollback review artifact: xóa `docs/OPERATIONS_COMPLETION_REPORT.md`; không có application/database rollback nào cần chạy cho lượt review.
