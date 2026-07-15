# 247 Home — Threat Model

## 1. Phạm vi

Threat model áp dụng cho MVP modular monolith:

- Next.js App Router UI và Route Handlers.
- Auth.js authentication/session.
- Application/domain modules.
- Prisma, raw SQL có kiểm soát và PostgreSQL.
- Storefront, customer account, admin và technician workspace.
- Dữ liệu catalog, địa chỉ, giỏ, đơn, payment thủ công, lịch, kỹ thuật viên, bảo hành và audit.
- Docker Compose local/test và GitHub Actions.

Ngoài phạm vi hiện tại:

- Production infrastructure, cloud, WAF, CDN và disaster recovery.
- Payment gateway và card processing.
- Email/SMS/object storage.
- Mobile native.
- Microservices.

Threat model phải review lại trước production, thêm provider ngoài hoặc xử lý upload.

## 2. Tài sản cần bảo vệ

| Tài sản | Mức | Rủi ro chính |
|---|---|---|
| Session, token xác minh, credential | Critical | Chiếm tài khoản |
| Role và permission | Critical | Leo thang đặc quyền |
| Giá/tổng đơn | Critical | Gian lận tài chính |
| Inventory reservation/counters | High | Oversell, sai tồn |
| Slot capacity/assignment | High | Overbooking, xung đột lịch |
| Order/payment state | High | Gian lận, mất toàn vẹn |
| PII: tên, phone, địa chỉ | High | Lộ riêng tư, stalking |
| Technician schedule/location context | High | Lộ dữ liệu nhân sự/khách |
| Warranty nội dung/ghi chú | Medium–High | Lộ PII/nội bộ |
| Audit logs | High | Mất khả năng truy vết hoặc lộ PII |
| Source, secret, CI credential | Critical | Xâm nhập hệ thống |
| Availability checkout/admin | High | Mất doanh thu/vận hành |

Không có lý do hợp lệ để nhận hoặc lưu PAN, CVV, expiry hoặc credential ngân hàng.

## 3. Actor và trust boundary

### Actor

- Anonymous.
- CUSTOMER.
- STAFF.
- TECHNICIAN.
- MANAGER.
- ADMIN.
- Developer/CI operator.
- Kẻ tấn công ngoài.
- Insider có tài khoản hợp lệ.

### Trust boundary

```text
Browser không tin cậy
  | HTTPS + cookie/session + CSRF controls
  v
Next.js Route Handler / Server Action boundary
  | validation + authorization
  v
Application/domain boundary
  | transaction + invariant
  v
Prisma/raw SQL adapter
  | parameterized DB protocol
  v
PostgreSQL

Developer workstation / GitHub Actions
  | secrets, migrations, artifacts
  v
Local/Test infrastructure
```

Dữ liệu từ browser, cookie, header, URL, database JSON, environment và CI artifact đều cần validation hoặc kiểm soát phù hợp.

## 4. Phương pháp

Dùng STRIDE kết hợp abuse case và kiểm tra quyền:

- **S**poofing: giả mạo danh tính.
- **T**ampering: sửa dữ liệu/trạng thái.
- **R**epudiation: phủ nhận thao tác.
- **I**nformation disclosure: lộ dữ liệu.
- **D**enial of service: làm cạn tài nguyên.
- **E**levation of privilege: leo quyền.

Mức rủi ro:

- **Critical**: chiếm ADMIN, sửa giá/đơn diện rộng, lộ secret.
- **High**: IDOR PII, oversell/overbooking, session takeover.
- **Medium**: abuse giới hạn, metadata leak, resource exhaustion cục bộ.
- **Low**: tác động nhỏ, cần điều kiện khó.

## 5. Threat register

| ID | Threat | STRIDE | Mức | Kiểm soát bắt buộc | Kiểm chứng |
|---|---|---|---|---|---|
| T-01 | Session giả mạo/đánh cắp | S/E | Critical | Auth.js; cookie `HttpOnly`, `Secure` khi HTTPS, `SameSite`; rotate/revoke; không log token; auth version | Auth/session integration, cookie config review |
| T-02 | CSRF mutation checkout/admin | T/E | High | Origin allowlist; CSRF strategy cho cookie auth; SameSite; reject unsafe content type | Cross-origin Playwright/contract tests |
| T-03 | IDOR đọc/sửa order/address/warranty | I/T | High | Query scope bằng owner; deny mặc định; ngoài scope trả 404; DTO whitelist | Negative authorization tests từng resource |
| T-04 | Technician đọc lịch người khác | I/E | High | Active assignment scope; field minimization | Assigned/unassigned integration tests |
| T-05 | STAFF leo thành ADMIN hoặc tự gán role | E | Critical | Role API ADMIN-only; server policy; bảo vệ ADMIN cuối; session invalidation; audit | RBAC matrix tests |
| T-06 | Client sửa giá/tổng | T | Critical | Request không nhận giá; server load catalog và tính lại; DB money constraints/snapshot | Tampered request tests |
| T-07 | Race condition oversell | T/D | High | Transaction, `FOR UPDATE`, lock order ổn định, DB check, allocation lifecycle, idempotency | Concurrent PostgreSQL tests |
| T-08 | Race condition overbook slot | T/D | High | Lock capacity row, atomic counter/check, release once | Concurrent booking/reschedule tests |
| T-09 | Assignment trùng lịch | T | High | PostgreSQL exclusion constraint + transaction validation | Concurrent overlap test |
| T-10 | Replay checkout tạo đơn trùng | T/D | High | User-scoped idempotency key + fingerprint + unique constraint | Replay/concurrent test |
| T-11 | Transition trái phép/lost update | T | High | Action endpoint, state table, expectedVersion, lock, invariant | Exhaustive state tests |
| T-12 | SQL injection, nhất là raw SQL | T/I | Critical | Prisma/parameterized SQL; không interpolation; repository review | Static review + malicious input integration |
| T-13 | Stored/reflected XSS qua description/note | T/I | High | Plain text baseline; React escaping; sanitize nếu markdown; CSP; không raw HTML | XSS payload tests |
| T-14 | Open redirect/Auth callback abuse | S | High | Internal return URL allowlist; Auth.js safe callbacks | Redirect tests |
| T-15 | Brute force/account enumeration | S/D | High | Rate limit; generic auth response; lockout/backoff provider policy | Rate-limit and response comparison tests |
| T-16 | Log/audit lộ token, phone, address, bank ref | I | High | Structured allowlist; redaction; không raw body; retention/access policy | Log capture tests |
| T-17 | Audit bị bỏ qua/sửa/xóa | R/T | High | Insert cùng transaction; không mutation API; DB privilege hạn chế; ADMIN read | Transaction and permission tests |
| T-18 | Mass assignment fields như role/userId/status | E/T | High | Strict Zod command schemas; actor từ session; action-specific DTO | Unknown-field tests |
| T-19 | Pagination/search gây DB exhaustion | D | Medium | Limit cap, index, query timeout, rate limit, bounded date range | Load/query-plan tests |
| T-20 | Body/note quá lớn | D | Medium | Request body and field length limits; reject early | Boundary tests |
| T-21 | Cache lộ dữ liệu cross-user/stale auth | I/E | High | Private no-store cho auth data; cache key/invalidation; không shared cache | Cache header tests |
| T-22 | Secret commit hoặc lộ trong CI artifact | I/E | Critical | `.env` ignored; GitHub secrets; secret scanning; artifact review; no echo | CI policy checks |
| T-23 | Dependency/supply-chain compromise | E | High | pnpm lockfile; frozen install; dependency review; pin actions; minimal deps | CI/config review |
| T-24 | Migration phá/xóa dữ liệu | T/D | High | Migration review, backup note, rollback plan; không reset/prod migration | Migration test |
| T-25 | SSRF qua image URL/provider tương lai | I/D | Medium | URL scheme/domain allowlist; không server-fetch arbitrary URL | URL validation tests |
| T-26 | BOLA qua order number đoán được | I | High | Authorization theo owner; order number không phải credential | Enumeration tests |
| T-27 | Payment confirmation gian lận insider | T/R | High | Permission riêng; amount immutable; reason/external ref; audit; optional dual control cần duyệt | Role/audit tests |
| T-28 | Inventory adjustment gian lận insider | T/R | High | Permission riêng, reason, invariant, audit, reconciliation | Negative and audit tests |
| T-29 | Last ADMIN removal | E/D | High | Transaction lock/policy ngăn admin cuối bị gỡ | Concurrent role-removal test |
| T-30 | Error lộ stack/SQL/existence | I | Medium | Error mapper; request ID; 404 scope; production-safe response | Error snapshot tests |
| T-31 | Clickjacking admin | S/T | Medium | `frame-ancestors 'none'`/X-Frame-Options | Header test |
| T-32 | Browser content sniffing/referrer leak | I | Medium | `nosniff`, strict referrer policy, permissions policy | Header test |
| T-33 | Warranty text chứa PII/malware link | I/T | Medium | Plain text, length limit, output encoding; upload ngoài MVP | Payload tests |
| T-34 | Stale role trong JWT/session | E | High | DB sessions hoặc authVersion validation/invalidation | Revoke-role integration |
| T-35 | Dev/test fixture dùng PII thật | I | Medium | Synthetic fixtures; review seed; no DB dumps committed | Repository scan |

## 6. Abuse cases ưu tiên

### 6.1 Sửa tổng tiền

Kẻ tấn công chỉnh response quote hoặc gửi `grandTotal: "1"`.

Control:

- Strict schema reject unknown money fields.
- Checkout load ID/quantity từ cart, giá/package/fee từ DB.
- DB check tổng và order item snapshot.
- Test gửi giá âm, overflow, số thực, string ngoài range và tổng giả.

### 6.2 Mua SKU cuối đồng thời

Hai session checkout SKU còn một.

Control:

- Lock inventory row trong transaction.
- Check `on_hand - reserved`.
- Một transaction thành công; transaction kia trả conflict.
- Không tạo order/payment/appointment cho request thất bại.

### 6.3 Chiếm slot cuối

Hai khách chọn cùng slot capacity một.

Control tương tự inventory; `COUNT` không khóa không đủ.

### 6.4 Đọc đơn người khác

Customer đổi path ID hoặc order number.

Control:

- Repository query `id AND user_id`.
- 404 cho sai scope.
- Không cache response shared.
- Test list/detail/action.

### 6.5 Technician lấy PII ngoài nhiệm vụ

Technician đoán assignment ID hoặc giữ URL cũ sau reassign.

Control:

- Query yêu cầu assignment active tại thời điểm request.
- Session không chứa danh sách assignment stale.
- DTO chỉ dữ liệu cần thi công.
- Assignment cancel có hiệu lực ngay.

### 6.6 Admin mutation không audit

Mutation thành công nhưng audit insert lỗi.

Control: audit insert cùng transaction; toàn bộ rollback. Không bắt lỗi audit rồi tiếp tục.

### 6.7 Role stale

ADMIN gỡ role nhưng session cũ vẫn có quyền.

Control: ưu tiên database session hoặc kiểm `authVersion`; invalidate session khi đổi role.

## 7. Authentication controls

- Chọn Auth.js provider trước implementation.
- Không tự viết crypto/session.
- Nếu Credentials: password hash chuyên dụng, password policy và recovery flow cần security review.
- Generic login/reset response chống enumeration.
- Session fixation được kiểm bằng rotate sau authentication.
- Cookie prefix/domain/path tối thiểu.
- Re-authentication hoặc step-up cho gán ADMIN có thể cần sau MVP; cần duyệt.
- Bootstrap ADMIN là thao tác có tài liệu, không hard-code credential.
- Không truyền token trong URL.
- Auth event log không chứa credential.

## 8. Authorization controls

Mỗi use case khai báo:

1. Actor bắt buộc hay public.
2. Role/permission.
3. Ownership/assignment scope.
4. State guard.
5. Field-level output policy.
6. Audit requirement.

UI guard/middleware không thay server policy. ADMIN vẫn đi qua validation và state machine. Không dùng role lấy từ request body.

## 9. Input/output controls

- Zod strict tại server.
- Giới hạn body, string, array, quantity, date range, pagination.
- Money parse thành `bigint` sau regex/range check.
- URL chỉ `https` và host allowlist nếu cần.
- Plain text cho note/description; không `dangerouslySetInnerHTML`.
- React escaping mặc định.
- CSV/export tương lai phải chống formula injection.
- Error không phản chiếu raw payload.

## 10. Database controls

- Runtime DB role least privilege.
- Migration credential tách runtime ở môi trường tương lai.
- Prisma/parameterized SQL.
- Check, unique, FK, exclusion constraints.
- Transaction timeout; lock order ổn định.
- Không gọi network trong transaction.
- Không `prisma migrate reset` trên DB cần giữ.
- Không chạy migration production trong dự án này.
- Backup/restore plan trước destructive migration.

## 11. HTTP và browser controls

Baseline headers trước release candidate:

```text
Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

CSP cụ thể phải phù hợp Next.js/Auth provider và không dùng `'unsafe-eval'` production. HSTS chỉ cấu hình tại môi trường HTTPS production tương lai. CORS mặc định same-origin; không mở `*` cho credential.

## 12. Rate limit và DoS

Endpoint ưu tiên:

- Login/recovery/Auth callbacks.
- Service-area check.
- Slot list.
- Checkout/quote.
- Warranty create.
- Admin role/payment/inventory actions.

Giới hạn cụ thể cần load test và production storage design. Local in-memory limiter không được mô tả là bảo vệ production đa instance. Query có timeout, cursor và range cap.

## 13. Logging, audit và privacy

- Application log dùng allowlist metadata.
- Không log raw cookie, Authorization, body address, warranty description hoặc bank reference đầy đủ.
- Mask phone/email khi cần support.
- Audit before/after chỉ trường nghiệp vụ không nhạy cảm.
- Quyền đọc audit: MANAGER theo scope, ADMIN toàn bộ.
- Retention và anonymization cần pháp lý/chủ sản phẩm duyệt.
- Dùng dữ liệu giả trong test.

## 14. Secret và CI

- Secret qua environment; schema validate khi startup.
- `.env*` local không commit, chỉ `.env.example` không giá trị thật ở phase implementation.
- GitHub Actions pin action theo version/commit, permission tối thiểu.
- Pull request từ fork không được nhận production secret.
- Không in environment vào log.
- Artifact test phải review PII/trace/video.
- Production secret/deploy nằm ngoài scope.

## 15. Security test gate

Trước nghiệm thu MVP:

- RBAC, ownership, assignment negative tests đạt.
- CSRF cross-origin mutation bị chặn.
- XSS payload hiển thị như text.
- SQL injection payload không đổi query.
- Concurrent oversell/overbooking/assignment conflict đạt.
- Price tampering không ảnh hưởng DB.
- Session/role revoke test đạt.
- Security headers và cache headers đạt.
- Error/log redaction test đạt.
- Dependency audit được review; không tự động coi mọi advisory là exploitable hoặc bỏ qua.
- Secret scan không phát hiện secret thật.
- Playwright không lưu PII thật.

## 16. Residual risk và điểm cần duyệt

1. Auth provider/session strategy chưa chọn.
2. Rate-limit production storage chưa thiết kế vì không deploy production.
3. Retention/anonymization PII và audit chưa có quyết định pháp lý.
4. Insider payment/inventory có cần dual approval.
5. Upload ảnh warranty ngoài MVP; nếu thêm phải threat-model storage, MIME, malware và signed URL.
6. Address normalization provider có thể thêm SSRF/privacy/vendor risk.
7. CSP chính xác phụ thuộc Auth provider/image source.
8. Recovery/MFA/step-up cho ADMIN chưa chốt.
9. Payment transfer reference có mức nhạy cảm và mask thế nào.
10. Backup/encryption-at-rest thuộc production review sau.