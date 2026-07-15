# 247 Home — Implementation Plan

## 1. Nguyên tắc thực hiện

Kế hoạch chia MVP thành vertical slice nhỏ, mỗi slice tạo giá trị kiểm chứng được từ UI/API qua domain đến PostgreSQL. Không xây toàn bộ tầng DB rồi mới làm UI.

Quy tắc chung:

- Stack cố định; không microservices.
- Mỗi slice có migration riêng khi cần.
- Mọi input validation và authorization tại server.
- Giá/tổng chỉ do server tính.
- Mutation quan trọng có transaction, expected version và audit theo policy.
- Test PostgreSQL thật cho constraint/concurrency; không thay bằng SQLite.
- Không merge khi lint, typecheck, test hoặc build lỗi.
- Không deploy production.
- Rollback không xóa/reset database.
- Production dependency mới phải giải thích mục đích, phương án không thêm và rủi ro.

## 2. Phase và dependency

```text
Phase 0: Quyết định mở
  -> Phase 1: Nền tảng
  -> Phase 2: Catalog + vùng phục vụ
  -> Phase 3: Cart + pricing
  -> Phase 4: Checkout + inventory + slot
  -> Phase 5: Order/payment operations
  -> Phase 6: Installation + technician
  -> Phase 7: Warranty
  -> Phase 8: Hardening + release candidate nội bộ
```

Mỗi slice phải đạt Definition of Done riêng trước slice phụ thuộc. Feature flag hoặc route exposure có thể giữ slice chưa hoàn chỉnh khỏi người dùng; không thêm dependency chỉ để dùng feature flag.

---

## Slice 0 — Chốt quyết định nghiệp vụ và ADR

### Phạm vi

- Duyệt các điểm mở chặn schema và state machine.
- Chốt Auth provider/session strategy, ID, combo, slot, inventory consume, cancellation, warranty và permission STAFF.
- Ghi ADR; đồng bộ tài liệu nếu quyết định đổi baseline.

### File/module dự kiến

- `docs/decisions/ADR-*.md`
- Các tài liệu trong `docs/`
- Không có source code.

### Database thay đổi

Không có.

### Security requirements

- Review data classification, retention và Auth strategy.
- Không chọn provider/dependency khi chưa threat review.
- Ma trận quyền deny-by-default được chủ sản phẩm và security reviewer ký duyệt.

### Acceptance criteria

- Không còn quyết định P0 mơ hồ chặn migration đầu tiên.
- State enum, ID, payment guard, capacity và combo nhất quán mọi tài liệu.
- Owner và ngày quyết định được ghi.

### Test cần có

- Documentation consistency review.
- Traceability thủ công từ requirement đến planned slice.

### Cách rollback

Revert ADR chưa triển khai và cập nhật lại tài liệu. ADR đã dẫn tới migration phải có ADR thay thế; không sửa lịch sử quyết định.

---

## Slice 1 — Bootstrap ứng dụng và quality gates

### Phạm vi

- Khởi tạo Next.js App Router strict TypeScript bằng pnpm.
- Tailwind CSS, shadcn/ui baseline, Vitest, Playwright.
- Docker Compose PostgreSQL local/test.
- GitHub Actions lint, typecheck, unit, integration, build, E2E.
- Environment validation, error envelope, request ID, health/readiness.

### File/module dự kiến

- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`
- `next.config.*`, Tailwind/PostCSS config
- `app/layout.tsx`, `app/api/health`, `app/api/ready`
- `src/shared/{validation,http,errors,logging,db}`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `vitest.config.*`, `playwright.config.*`
- `.env.example`, `.gitignore`

### Database thay đổi

- Prisma setup.
- Migration baseline rỗng hoặc chỉ extension đã duyệt.
- Không tạo business table trước slice sở hữu.

### Security requirements

- Strict environment schema; không secret mặc định nguy hiểm.
- `.env*` bị ignore.
- CI permission tối thiểu; action pin.
- Health không lộ config/version.
- Security headers baseline.
- Không raw request body log.

### Acceptance criteria

- App chạy local với PostgreSQL Compose.
- Health/readiness behavior đúng.
- Pipeline sạch trên clone mới.
- Không `any` không giải thích.
- Không có production deployment workflow.

### Test cần có

- Unit environment/error mapper.
- Integration readiness khi DB up/down.
- Playwright smoke page.
- Header/cache smoke.
- Build production mode local.

### Cách rollback

- Revert bootstrap commit.
- Dừng Compose, giữ volume trừ khi người dùng chủ động xóa.
- Không reset DB.
- Dependency thêm bị rollback cùng lockfile.

---

## Slice 2 — Identity, Auth.js và RBAC

### Phạm vi

- Auth.js theo ADR.
- User, role, user-role.
- Session actor context.
- Policy primitives RBAC/ownership/assignment.
- Admin role assignment và bảo vệ ADMIN cuối.
- Audit role mutation.

### File/module dự kiến

- `src/modules/identity/{domain,application,infrastructure,presentation}`
- `src/shared/auth`
- `app/api/auth/[...nextauth]`
- `app/api/v1/me`
- `app/api/v1/admin/users/**`
- `app/(auth)/**`
- `tests/integration/identity/**`

### Database thay đổi

- `users`, `roles`, `user_roles`.
- Auth.js adapter tables theo provider/session.
- Seed năm system roles.
- Unique/index và `auth_version`.

### Security requirements

- Cookie/session safe; return URL allowlist.
- Role lấy từ DB/session server, không từ body.
- ADMIN-only role mutation.
- Không gỡ ADMIN cuối cùng, kể cả concurrent requests.
- Session invalidation khi role đổi.
- Không log password/token; không tự viết crypto.
- CSRF/origin control.

### Acceptance criteria

- User đăng nhập/đăng xuất theo provider đã duyệt.
- Mỗi route protected phân biệt 401/403/404 scope.
- Role change có hiệu lực theo SLA chốt.
- Role mutation có audit cùng transaction.

### Test cần có

- Auth/session integration.
- Ma trận role positive/negative.
- Open redirect/CSRF.
- Stale session sau revoke.
- Hai request gỡ ADMIN cuối cùng.
- Audit commit/rollback.
- Playwright login/logout và admin denial.

### Cách rollback

- Tắt route role administration trước.
- Rollback application về schema tương thích.
- Giữ identity tables/data; không drop user/session có dữ liệu.
- Migration bù nếu constraint cần sửa.

---

## Slice 3 — Catalog đọc công khai

### Phạm vi

- Product, variant, image, service package read model.
- Catalog list/detail, filter cơ bản.
- Server Components storefront.
- Money DTO string.

### File/module dự kiến

- `src/modules/catalog/**`
- `src/shared/money`
- `app/(storefront)/products/**`
- `app/api/v1/products/**`
- UI trong `src/ui` và shadcn components cần thiết.

### Database thay đổi

- `products`, `product_variants`, `product_images`, `service_packages`.
- Index catalog.
- Seed dữ liệu giả MVP.

### Security requirements

- Chỉ ACTIVE/published ra public.
- DTO whitelist.
- Plain text/escaped description.
- Image URL allowlist.
- Query/pagination bounded.
- Không lộ cost/internal/inventory count.

### Acceptance criteria

- Anonymous xem danh sách/chi tiết năm nhóm MVP.
- Variant/package/giá đúng từ server.
- Draft/archive không xuất hiện.
- Responsive và keyboard accessible.

### Test cần có

- Domain/mapper unit.
- Repository/filter/inactive integration.
- XSS and URL validation.
- API contract/money string.
- Playwright list/detail/filter.
- Accessibility smoke.

### Cách rollback

- Ẩn storefront route hoặc revert app.
- Giữ catalog tables/data.
- Không drop ảnh/product đã được tham chiếu ở slice sau.

---

## Slice 4 — Quản trị catalog và audit

### Phạm vi

- Product/variant/package create, edit, publish, archive.
- Price update.
- Product image metadata.
- Admin UI và audit.

### File/module dự kiến

- `app/admin/catalog/**`
- `app/api/v1/admin/products/**`
- `app/api/v1/admin/product-variants/**`
- `app/api/v1/admin/service-packages/**`
- `src/modules/audit/**`
- Catalog application commands.

### Database thay đổi

- `audit_logs`.
- Constraint/version còn thiếu từ slice đọc.
- Không hard-delete catalog.

### Security requirements

- Permission catalog cụ thể; không dựa route prefix.
- Strict schemas, money range check.
- Expected version chống lost update.
- Audit cùng transaction, data redact.
- Không raw HTML.

### Acceptance criteria

- Actor được phép quản lý catalog qua action hợp lệ.
- Price thay đổi không sửa order snapshot tương lai.
- Unauthorized actor không mutation.
- Mọi mutation nhạy cảm có audit.

### Test cần có

- Policy matrix.
- Strict validation/mass assignment.
- Concurrent version conflict.
- Audit rollback.
- Public cache invalidation.
- Playwright admin CRUD/publish/archive.

### Cách rollback

- Tắt admin catalog mutations.
- Giữ schema và audit.
- Revert giá sai bằng action bù có reason/audit, không sửa DB trực tiếp.
- Không xóa migration đã áp dụng.

---

## Slice 5 — Service area và slot configuration

### Phạm vi

- Kiểm tra vùng public.
- Admin quản lý vùng và slot/capacity.
- Slot list availability sơ bộ.

### File/module dự kiến

- `src/modules/service-areas/**`
- `src/modules/installations/domain/slot*`
- `app/api/v1/service-areas/check`
- `app/api/v1/installation-slots`
- `app/api/v1/admin/service-areas/**`
- `app/api/v1/admin/installation-slots/**`
- `app/admin/service-areas/**`

### Database thay đổi

- `service_areas`, `installation_slots`.
- Geographic uniqueness/index.
- Capacity checks/version.

### Security requirements

- Public endpoint rate limit và bounded input.
- Server match lại ở checkout.
- MANAGER/ADMIN mutation baseline.
- Capacity không giảm dưới booked.
- Audit admin mutation.
- Không dùng provider địa chỉ ngoài nếu chưa review.

### Acceptance criteria

- Supported/unsupported/ambiguous trả contract đúng.
- Slot chỉ active, trong date range và available.
- Admin không tạo invalid/overlap theo policy.
- Public result không cam kết booking.

### Test cần có

- Matching unit/table tests.
- Constraint/repository integration.
- Rate/boundary tests.
- Admin authorization/audit.
- Timezone/date tests.
- Playwright service check.

### Cách rollback

- Tắt public area/slot route nếu dữ liệu sai.
- Deactivate area/slot bằng action có audit.
- Giữ rows được tham chiếu; không hard-delete.
- Backfill sửa mã địa lý bằng migration bù.

---

## Slice 6 — Inventory administration

### Phạm vi

- Inventory per variant.
- Admin list và adjustment.
- Domain reserve/release/consume primitives chưa exposed checkout.
- Reconciliation query nội bộ.

### File/module dự kiến

- `src/modules/inventory/**`
- `app/api/v1/admin/inventory/**`
- `app/admin/inventory/**`
- `tests/concurrency/inventory*`

### Database thay đổi

- `inventory`.
- Check `reserved <= on_hand`.
- Version/index.
- Chưa tạo allocation cho đến checkout slice hoặc có thể tạo schema sớm nếu ADR chốt.

### Security requirements

- Permission riêng.
- Reason bắt buộc, expected version.
- Row lock và parameterized raw SQL.
- Không giảm on-hand dưới reserved.
- Audit cùng transaction.

### Acceptance criteria

- Adjustment hợp lệ cập nhật nguyên tử.
- Conflict/stale version trả 409.
- Invariant DB không thể bị phá qua API.
- Catalog public chỉ thấy availability coarse.

### Test cần có

- Money/quantity/schema unit.
- DB constraints.
- Concurrent adjustments.
- Negative role tests.
- SQL injection raw helper.
- Audit commit/rollback.
- Playwright inventory admin.

### Cách rollback

- Tắt mutation adjustment.
- Sửa số lượng bằng compensating adjustment đã duyệt/audit.
- Không set trực tiếp hoặc reset DB.
- Giữ inventory rows.

---

## Slice 7 — Address, cart và server pricing

### Phạm vi

- Customer address CRUD.
- Active cart và items.
- Quote server với package compatibility, area fees và availability.
- Cart/storefront UI.

### File/module dự kiến

- `src/modules/{cart,pricing}/**`
- Address application trong identity/customer profile module đã chọn
- `app/api/v1/{addresses,cart,checkout/quote}/**`
- `app/(account)/addresses/**`
- `app/(storefront)/cart/**`

### Database thay đổi

- `addresses`, `carts`, `cart_items`.
- Một active cart/user; một default address.
- Composite item uniqueness.

### Security requirements

- Ownership query tại DB.
- Actor/user ID từ session.
- Strict quantity/ID schemas.
- Giá/package/fee load server; client total bị reject.
- Address/phone không log.
- Auth response no-store.

### Acceptance criteria

- Customer chỉ quản lý dữ liệu own.
- Cart hỗ trợ variant/package/quantity.
- Quote phản ánh catalog/area hiện tại.
- Quote không reserve inventory/slot.
- Invalid/inactive/incompatible item báo theo dòng.

### Test cần có

- Pricing arithmetic/overflow unit.
- Ownership negative integration.
- Package compatibility.
- Tampered price fields.
- Concurrent active cart/item update.
- PII log redaction.
- Playwright cart/address/quote.

### Cách rollback

- Tắt cart mutation/quote UI.
- Giữ address/cart data.
- Không migrate cart thành order.
- Revert pricing logic; không sửa giá catalog để bù lỗi code.

---

## Slice 8 — Checkout COD và inventory concurrency

### Phạm vi

- Tạo order COD idempotent từ cart.
- Server re-pricing trong transaction.
- Inventory allocation/reservation.
- Order/item/payment snapshot.
- Customer order detail cơ bản.
- Chưa yêu cầu installation nếu cart không có service.

### File/module dự kiến

- `src/modules/{checkout,orders,payments}/**`
- Inventory transaction participants
- `app/api/v1/orders/**`
- `app/(account)/orders/**`
- `tests/concurrency/checkout*`

### Database thay đổi

- `orders`, `order_items`, `payments`, `inventory_allocations`.
- Idempotency unique/fingerprint.
- Money/check/FK/index constraints.

### Security requirements

- Auth + ownership + CSRF/origin.
- Client không gửi giá/tổng.
- Lock inventory rows theo ID.
- No network trong transaction.
- Idempotency/retry bounded.
- Payment không chứa card data.
- DTO redact.

### Acceptance criteria

- COD order lưu snapshot/tổng chính xác.
- SKU cuối dưới hai checkout chỉ tạo một order thành công.
- Same idempotency key/payload tạo một order.
- Failure không để partial order/payment/allocation.
- Cart đóng chỉ sau commit.

### Test cần có

- Pricing tamper.
- Concurrent last-item.
- Idempotency same/different payload/in-progress.
- Deadlock/serialization retry.
- DB constraints.
- Ownership and CSRF.
- Transaction rollback injection.
- Playwright COD checkout/order detail.

### Cách rollback

- Tắt checkout route trước.
- Giữ order và reservation đã tạo.
- Release reservation chỉ qua compensating cancel command có đối soát.
- Không drop financial/history tables.
- Revert reader vẫn phải đọc order hiện có hoặc cung cấp compatibility.

---

## Slice 9 — Checkout có lắp đặt và slot concurrency

### Phạm vi

- Checkout cart yêu cầu service.
- Address re-match và slot booking cùng transaction.
- Tạo appointment.
- Customer xem/reschedule/cancel theo baseline policy.

### File/module dự kiến

- `src/modules/installations/**`
- Checkout orchestration extension
- `app/api/v1/installation-appointments/**`
- Customer installation UI.

### Database thay đổi

- `installation_appointments`.
- Capacity release marker, version/index.
- Unique appointment/order.

### Security requirements

- Own address/order/appointment.
- Lock inventory và slot theo order cố định.
- Reschedule locks old/new slot.
- Release capacity once.
- Internal note không trả customer.

### Acceptance criteria

- Checkout lắp đặt tạo order/payment/appointment nguyên tử.
- Slot cuối chỉ một checkout thành công.
- Reschedule failure giữ slot cũ.
- Cancel order release inventory và slot một lần.

### Test cần có

- Concurrent slot booking.
- Combined inventory/slot failure matrix.
- Reschedule/cancel races.
- Ownership/PII DTO.
- Timezone.
- Playwright checkout with installation/tracking.

### Cách rollback

- Ngăn checkout mới có service.
- Giữ và phục vụ appointment đã tạo.
- Dùng cancel/reschedule command bù; không chỉnh counter trực tiếp.
- Chạy reconciliation read-only trước/sau rollback.

---

## Slice 10 — Order state và chuyển khoản thủ công

### Phạm vi

- Admin order queue/actions.
- Payment confirm/fail.
- BANK_TRANSFER checkout instructions.
- Inventory consume/release theo state machine.
- Customer cancel policy.

### File/module dự kiến

- Order/payment domain state machines
- `app/api/v1/admin/{orders,payments}/**`
- `app/admin/orders/**`
- Customer cancel action.

### Database thay đổi

- Timestamp/version/state fields đã thiết kế.
- Optional status history nếu ADR duyệt.
- Không sửa money snapshots.

### Security requirements

- Action-specific permission.
- Expected version/state guard.
- Payment amount immutable.
- Reason/audit.
- Customer own cancellation.
- Consume/release exactly once.

### Acceptance criteria

- Mọi transition table đúng.
- Transfer order chỉ confirm theo payment policy.
- Cancel/consume cạnh tranh không phá invariant.
- Admin không bypass state machine.
- Customer timeline không lộ internal fields.

### Test cần có

- Exhaustive state unit.
- Payment guard integration.
- Concurrent transition/cancel-consume.
- Audit.
- Role/ownership.
- Playwright COD và transfer operations.

### Cách rollback

- Tắt action mutation có lỗi.
- Không đổi state trực tiếp; dùng compensating workflow được duyệt.
- Với consumed inventory, không chuyển giả sang cancelled.
- Giữ enum value/schema; rollback application tương thích.

---

## Slice 11 — Technician và assignment

### Phạm vi

- Technician profile/status/area/skill.
- Admin assignment.
- Technician schedule/workspace.
- Accept, en-route, start và report issue.

### File/module dự kiến

- `src/modules/technicians/**`
- Installation assignment application
- `app/api/v1/admin/technicians/**`
- `app/api/v1/admin/installation-appointments/**`
- `app/api/v1/technician/**`
- `app/admin/technicians/**`
- `app/technician/**`

### Database thay đổi

- `technicians`, `technician_assignments`.
- `technician_service_areas` nếu duyệt.
- `btree_gist` và exclusion constraint.
- Assignment status/version/index.

### Security requirements

- TECHNICIAN assigned-only.
- Minimum PII DTO.
- MANAGER/ADMIN write baseline; STAFF theo permission.
- DB exclusion chống overlap.
- Deactivate có guard lịch mở.
- Audit assign/reassign/deactivate.

### Acceptance criteria

- Không thể phân hai job overlap cho một technician.
- Reassignment thu hồi quyền xem của technician cũ ngay.
- Technician chỉ action state hợp lệ.
- Start yêu cầu order ready.

### Test cần có

- Concurrent overlap.
- Assignment ownership negative.
- Stale assignment/session.
- Skill/area/status guards.
- Audit.
- Playwright admin assign + technician flow.

### Cách rollback

- Tắt assignment/action routes.
- Giữ assignment history.
- Cancel/reassign bằng command có audit.
- Nếu rollback exclusion constraint, tạm dừng mutation trước; không cho overlap mới.

---

## Slice 12 — Hoàn tất installation và đồng bộ order

### Phạm vi

- Technician complete.
- Installation/order completion nguyên tử.
- Reschedule-required workflow.
- Customer installation timeline.

### File/module dự kiến

- Installation/order application orchestration
- Technician completion forms
- Admin exception queue
- Customer tracking UI.

### Database thay đổi

- Completion/resolution fields.
- Optional history tables nếu đã duyệt.

### Security requirements

- Assigned technician only.
- Plain-text bounded notes.
- Order/payment guards.
- Internal/public field separation.
- Audit internal exception actions.

### Acceptance criteria

- Start chuyển order sang installation-in-progress.
- Complete chuyển appointment, assignment và order đúng transaction.
- Failure rollback toàn bộ.
- Report issue không tự hủy order.
- Terminal states bất biến.

### Test cần có

- Exhaustive installation state.
- Atomic order sync failure injection.
- Concurrent complete/cancel.
- DTO redaction.
- Playwright end-to-end installation.

### Cách rollback

- Tắt completion action nếu orchestration lỗi.
- Giữ trạng thái hiện có; dùng repair command riêng sau đối soát.
- Không chỉnh nhiều bảng thủ công.
- Rollback reader/UI độc lập nếu mutation ổn.

---

## Slice 13 — Warranty

### Phạm vi

- Customer tạo/xem warranty own order item.
- Server eligibility.
- Admin queue/actions, public resolution/internal note.

### File/module dự kiến

- `src/modules/warranties/**`
- `app/api/v1/warranty-requests/**`
- `app/api/v1/admin/warranty-requests/**`
- Customer/admin warranty UI.

### Database thay đổi

- `warranty_requests`.
- Unique/index/open-request policy.
- Không upload table trong MVP.

### Security requirements

- Ownership theo order item.
- Eligibility server-side.
- Strict text/phone limits; output encoding.
- Internal note không trả customer.
- Admin actions permission/audit.
- Không log body.

### Acceptance criteria

- Chỉ item eligible/own tạo request.
- Customer thấy public fields.
- Admin state actions hợp lệ.
- Không upload/card/secret data.

### Test cần có

- Eligibility boundary dates.
- IDOR/field redaction.
- XSS/large body.
- Exhaustive warranty state.
- Audit.
- Playwright submit/process/view resolution.

### Cách rollback

- Tắt create/action routes.
- Giữ request/history.
- Không hard-delete request.
- Dùng action bù nếu trạng thái sai và policy cho phép.

---

## Slice 14 — Audit viewer và operational hardening

### Phạm vi

- Audit search/view.
- Structured log/redaction.
- Security/cache headers.
- Rate-limit adapter cho local/test.
- Error UX, accessibility và query performance.

### File/module dự kiến

- `app/admin/audit-logs/**`
- `app/api/v1/admin/audit-logs`
- `src/shared/{logging,http,security}`
- CI security/quality checks.
- Performance fixtures/scripts trong tests, không production dependency nếu tránh được.

### Database thay đổi

- Audit indexes dựa query plan.
- Không mutation audit.
- Không retention purge trước policy.

### Security requirements

- MANAGER scoped, ADMIN full.
- Audit redact, no update/delete.
- Rate limits endpoint nhạy cảm.
- CSP/CSRF/cache/header verification.
- Secret scan/dependency review.
- PII-free fixtures/artifacts.

### Acceptance criteria

- Admin truy vết mọi mutation bắt buộc.
- Không actor trái phép đọc audit.
- Error/log không lộ PII/secret.
- Query P0 đạt mục tiêu kiểm thử.
- WCAG smoke đạt luồng P0.

### Test cần có

- Audit authorization/filter/pagination.
- Redaction snapshots.
- Security headers/cache.
- Rate/boundary.
- `EXPLAIN ANALYZE` query P0.
- Playwright accessibility và negative security.

### Cách rollback

- Tắt audit viewer, không tắt audit writer.
- Revert index bằng migration riêng nếu gây regression.
- Tắt limiter lỗi bằng config local có kiểm soát; giữ server validation/auth.
- Không xóa audit rows.

---

## Slice 15 — Release candidate nội bộ, không production

### Phạm vi

- E2E toàn MVP.
- Concurrency, migration, backup/restore local/test.
- Documentation/runbook.
- Bug fix và acceptance review.
- Không deploy production.

### File/module dự kiến

- `tests/e2e/**`, `tests/concurrency/**`
- `README.md`, `docs/**`
- CI reports/config.
- Local test data factory.

### Database thay đổi

- Chỉ migration sửa lỗi đã review.
- Kiểm thử upgrade từ snapshot phiên bản trước.
- Không destructive cleanup tùy tiện.

### Security requirements

- Threat model review.
- Secret/dependency scan.
- RBAC/IDOR/CSRF/XSS/tampering gates.
- Artifact không chứa PII.
- Không production credential/workflow.

### Acceptance criteria

- `DEFINITION_OF_DONE.md` đạt.
- Tất cả P0 trace được từ requirement đến test.
- Không oversell, overbook, duplicate order.
- Không known Critical/High security issue chưa có quyết định chấp nhận.
- Human acceptance hoàn tất trên môi trường local/test.

### Test cần có

- Full lint/typecheck/unit/integration/concurrency/build/E2E.
- Migration up trên DB sạch và DB phiên bản trước.
- Backup/restore drill local.
- Browser/accessibility matrix được duyệt.
- Manual operational scenarios.

### Cách rollback

- Không phát hành candidate lỗi; quay về commit candidate trước.
- Database local/test dùng migration bù hoặc restore bản backup có chủ đích.
- Không reset DB mặc định.
- Ghi rõ dữ liệu test tạo sau backup có thể mất nếu restore.

## 3. Traceability MVP

| Năng lực | Slice |
|---|---|
| Auth/RBAC | 2 |
| Catalog/combo | 3–4 |
| Vùng phục vụ | 5 |
| Inventory admin | 6 |
| Address/cart/pricing | 7 |
| COD checkout | 8 |
| Slot/installation checkout | 9 |
| Transfer/order operations | 10 |
| Technician assignment | 11–12 |
| Warranty | 13 |
| Audit/security hardening | 2, 4–14 |
| Full acceptance | 15 |

## 4. Quy tắc bắt đầu/kết thúc slice

### Ready

- Requirement và acceptance rõ.
- Quyết định nghiệp vụ chặn đã duyệt.
- Threats liên quan được xác định.
- Migration và rollback plan được review.
- Dependency mới được giải thích.
- Test data/strategy có sẵn.

### Done

- Scope hoạt động end-to-end.
- Migration, validation, authorization, audit đúng.
- Test yêu cầu đạt.
- Lint, typecheck, test, build đạt.
- Documentation cập nhật.
- Danh sách file sửa, test chạy và rủi ro còn lại được báo cáo.
- Không deploy production.

## 5. Rủi ro kế hoạch

- Quyết định combo muộn có thể đổi schema catalog/inventory.
- Auth provider muộn chặn identity.
- Policy hủy/consume muộn chặn order transaction.
- Capacity theo duration thay vì job làm slot schema phức tạp hơn.
- Permission STAFF không rõ gây over-privilege.
- Thêm upload/provider ngoài làm tăng threat/dependency/scope.
- E2E quá muộn có thể phát hiện boundary sai; vì vậy mỗi slice có Playwright riêng.