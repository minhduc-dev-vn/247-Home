# 247 Home

247 Home là ứng dụng thương mại điện tử dành cho thiết bị nhà thông minh và
dịch vụ lắp đặt tận nơi. Project cung cấp trọn luồng từ catalog, giỏ hàng,
checkout và theo dõi đơn đến điều phối kỹ thuật viên, nghiệm thu và bảo hành.

> **Trạng thái hiện tại:** local demo đã sẵn sàng. Render được hỗ trợ cho môi
> trường staging một instance. Project chưa được phê duyệt cho production,
> Vercel không còn là deployment target và AWS đang tạm hoãn.

## Tính năng hiện có

### Customer

- Đăng ký, đăng nhập, đăng xuất và đặt lại mật khẩu.
- Xem danh sách/chi tiết sản phẩm, biến thể, giá, tồn kho và gói lắp đặt.
- Kiểm tra khu vực phục vụ, quản lý giỏ hàng và checkout theo khung giờ.
- Thanh toán COD hoặc chuyển khoản; VNPay có feature gate và mặc định tắt.
- Xem lịch sử, chi tiết, trạng thái thanh toán và lịch lắp đặt của đơn hàng.
- Tạo, theo dõi yêu cầu bảo hành và tải evidence theo quyền sở hữu.

### Staff, Manager và Admin

- Quản lý catalog, tồn kho, gói dịch vụ và khu vực theo policy của từng role;
  chỉ `MANAGER/ADMIN` được thay đổi giá.
- Xem đơn hàng, xác nhận thanh toán và thực hiện transition được server cho phép.
- `MANAGER/ADMIN` phân công kỹ thuật viên, đổi lịch và xử lý xung đột lịch.
- Xem hàng đợi bảo hành và audit log có phân trang.

### Technician

- Chỉ xem công việc được phân công cho chính mình.
- Thực hiện đúng workflow `ASSIGNED -> EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED`.
- Ghi chú kết quả, upload và preview evidence qua endpoint có authorization.

### Nền tảng và bảo mật

- Auth.js credentials, session cookie và role `CUSTOMER`, `STAFF`,
  `TECHNICIAN`, `MANAGER`, `ADMIN`.
- Authorization, ownership và state transition được kiểm tra tại server.
- Transaction PostgreSQL, optimistic concurrency, idempotency và audit log cho
  các mutation quan trọng.
- Validation Zod, giới hạn request/upload, kiểm tra MIME và private object
  storage.
- Health endpoint tại `/api/health` và readiness endpoint tại `/api/ready`.

## Kiến trúc và công nghệ

247 Home là **modular monolith**: frontend, Route Handlers và business modules
được triển khai trong cùng ứng dụng Next.js, nhưng domain được tách theo
capability trong `src/modules/`.

| Thành phần          | Công nghệ                                           |
| ------------------- | --------------------------------------------------- |
| Web và API          | Next.js 16 App Router, React 19                     |
| Ngôn ngữ            | TypeScript strict mode                              |
| UI                  | Tailwind CSS 4, shadcn/ui conventions, Lucide icons |
| Authentication      | Auth.js / NextAuth.js credentials                   |
| Database            | PostgreSQL 16, Prisma 6                             |
| Validation và forms | Zod, React Hook Form                                |
| Object storage      | S3-compatible adapter; MinIO cho local demo         |
| Testing             | Vitest, PostgreSQL integration tests, Playwright    |
| Runtime             | Node.js 24, pnpm 11, Docker Compose                 |
| CI                  | GitHub Actions                                      |

## Chạy nhanh bằng Docker

Đây là cách được khuyến nghị để trải nghiệm đầy đủ project trên máy local.
Docker Compose chạy application production-like, PostgreSQL và MinIO, sau đó tự
apply migration và seed dữ liệu demo xác định.

### Yêu cầu

- Windows 10/11 với Docker Desktop và Docker Compose v2.
- Node.js 24 và pnpm `11.16.0`.
- Tối thiểu 6 GB RAM và 8 GB dung lượng trống.
- Các cổng `3000`, `5433`, `9000`, `9001` chưa được sử dụng.

### Khởi động

```powershell
pnpm install --frozen-lockfile
pnpm demo:up
docker compose --env-file .env.demo.example ps
```

Chờ `app`, `db` và `storage` chuyển sang trạng thái healthy, sau đó mở:

| Dịch vụ       | URL                              |
| ------------- | -------------------------------- |
| Ứng dụng      | http://127.0.0.1:3000            |
| Health        | http://127.0.0.1:3000/api/health |
| Readiness     | http://127.0.0.1:3000/api/ready  |
| MinIO Console | http://127.0.0.1:9001            |

Không cần tạo `.env` cho Docker demo. Các giá trị trong `.env.demo.example` chỉ
dành cho local và không được dùng ở staging hoặc production.

### Tài khoản demo

Tất cả tài khoản dưới đây dùng mật khẩu `LocalDemoOnly-247Home`:

| Vai trò      | Email                     |
| ------------ | ------------------------- |
| Customer     | `customer@example.com`    |
| Staff        | `staff@example.com`       |
| Manager      | `manager@example.com`     |
| Admin        | `admin@example.com`       |
| Technician 1 | `technician1@example.com` |
| Technician 2 | `technician2@example.com` |

Seed demo chỉ được phép chạy trên database local hoặc Render staging đã xác
nhận rõ. Nó bị chặn trong production và không chứa credential production.

### Reset hoặc dừng demo

```powershell
# Reset migration/seed/evidence trong phạm vi local demo đã allowlist
pnpm demo:reset

# Dừng container nhưng giữ volume PostgreSQL và MinIO
pnpm demo:down
```

Không chạy `docker compose down -v` trừ khi đã chủ động chấp nhận xóa toàn bộ dữ
liệu local.

Hướng dẫn demo chi tiết: [`docs/LOCAL_DEMO_RUNBOOK.md`](docs/LOCAL_DEMO_RUNBOOK.md).

## Chạy ở development mode

Development mode chạy Next.js trên máy host và PostgreSQL trong Docker. Ảnh/evidence
có thể dùng local adapter theo `.env.example`.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Trước khi chạy app, tạo một secret local và đặt vào `NEXTAUTH_SECRET` trong
`.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Mở `http://localhost:3000`. Khi dùng `127.0.0.1`, cập nhật đồng thời
`NEXTAUTH_URL` và `APP_ORIGIN` để cookie/origin validation dùng đúng một origin.

Password reset sử dụng PostgreSQL outbox. Worker local được chạy riêng bằng:

```powershell
pnpm password-reset:deliver
```

Để xem dữ liệu qua Prisma Studio:

```powershell
pnpm exec prisma studio
```

## Các lệnh chính

| Lệnh                    | Mục đích                                               |
| ----------------------- | ------------------------------------------------------ |
| `pnpm dev`              | Chạy Next.js development server                        |
| `pnpm build`            | Tạo production build                                   |
| `pnpm start`            | Chạy production build đã tạo                           |
| `pnpm lint`             | Chạy ESLint với zero warnings                          |
| `pnpm typecheck`        | Kiểm tra TypeScript strict                             |
| `pnpm format:check`     | Kiểm tra Prettier                                      |
| `pnpm docs:check`       | Kiểm tra link tài liệu và ADR trùng ID                 |
| `pnpm test`             | Chạy unit tests                                        |
| `pnpm test:integration` | Chạy integration tests trên PostgreSQL                 |
| `pnpm test:migration`   | Kiểm tra migration upgrade                             |
| `pnpm test:e2e`         | Chạy Playwright trên source server mới                 |
| `pnpm test:e2e:demo`    | Kiểm tra Docker demo đang chạy                         |
| `pnpm audit:prod`       | Kiểm tra advisory của production dependencies          |
| `pnpm db:migrate`       | Apply migration đã commit bằng `prisma migrate deploy` |
| `pnpm db:seed`          | Seed dữ liệu local có guard                            |
| `pnpm demo:up`          | Build và khởi động toàn bộ local demo                  |
| `pnpm demo:reset`       | Reset có guard cho local demo                          |
| `pnpm demo:down`        | Dừng demo và giữ volume                                |

## Quality gates

Thay đổi implementation phải vượt qua đầy đủ các gate sau:

```powershell
pnpm audit:prod
pnpm lint
pnpm typecheck
pnpm format:check
pnpm docs:check
pnpm test
pnpm test:integration
pnpm test:migration
pnpm test:e2e
pnpm build
```

Integration, migration và concurrency tests sử dụng PostgreSQL thật. CI khởi
tạo database sạch, apply migration, seed và chạy lại toàn bộ bộ kiểm tra trên
commit được push.

## Cấu trúc repository

```text
app/                 Next.js pages, layouts và Route Handlers
src/components/      Design system và UI theo capability
src/modules/         Identity, catalog, commerce, operations, payment, storage, warranty
src/shared/          Database, HTTP, auth, validation, logging và money helpers
prisma/              Schema, 17 migrations và seed có environment guard
tests/               Unit, PostgreSQL integration, migration và Playwright tests
public/              Static assets và product demo images
scripts/             Demo, migration, reconciliation và verification tools
docs/                Canonical specifications, ADR và runbooks
infrastructure/      AWS Terraform tham khảo; hiện đang tạm hoãn
```

## Environment và dữ liệu nhạy cảm

- Dùng `.env.example` làm template development; `.env` luôn bị Git ignore.
- Không commit database URL, password, Auth secret, VNPay secret hoặc storage
  access key.
- `NEXTAUTH_URL` và `APP_ORIGIN` phải khớp chính xác origin người dùng truy cập.
- Không chạy local seed, reset hoặc destructive migration trên hosted database.
- VNPay mặc định bị vô hiệu hóa bằng `VNPAY_PUBLIC_ENABLED=false` cho đến khi
  sandbox, reconciliation và phê duyệt vận hành hoàn tất.
- Production cần shared rate limiter, mail provider, object-storage lifecycle,
  backup/restore và monitoring đã được kiểm chứng.

Nếu một credential từng xuất hiện trong terminal, chat hoặc log công khai, hãy
coi credential đó đã lộ và rotate ngay cả khi nó không được commit.

## Deployment hiện tại

### Render staging

Render chạy repository này dưới dạng **Docker Web Service**, không phải Static
Site. Profile hiện tại chỉ hỗ trợ đúng một application instance vì rate limiter
staging còn process-local.

- Apply migration từ trusted operator environment trước khi deploy revision.
- Đặt secret trong Render Environment, không đưa vào source code.
- Dùng HTTPS origin giống nhau cho `NEXTAUTH_URL` và `APP_ORIGIN`.
- Cấu hình S3-compatible private storage cho catalog/evidence.
- Health check path: `/api/ready`.

Xem [`docs/RENDER_STAGING_RUNBOOK.md`](docs/RENDER_STAGING_RUNBOOK.md) trước khi
deploy.

### Không hỗ trợ

- **Vercel:** không còn là deployment target của repository.
- **AWS:** Terraform được giữ làm reference nhưng provisioning đang tạm hoãn.
- **Production:** chưa được phê duyệt cho traffic thật hoặc VNPay public.

## Tài liệu

[`docs/README.md`](docs/README.md) là mục lục canonical. Các tài liệu quan trọng:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
- [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md)
- [`docs/ORDER_STATE_MACHINE.md`](docs/ORDER_STATE_MACHINE.md)
- [`docs/INSTALLATION_STATE_MACHINE.md`](docs/INSTALLATION_STATE_MACHINE.md)
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)
- [`docs/DATABASE_RUNBOOK.md`](docs/DATABASE_RUNBOOK.md)
- [`docs/RELEASE_READINESS_RECORD.md`](docs/RELEASE_READINESS_RECORD.md)
- [`AGENTS.md`](AGENTS.md)

Khi tài liệu thay đổi, cập nhật file canonical hiện có thay vì tạo thêm báo cáo
theo từng task, sau đó chạy `pnpm docs:check`.
