# Cart Implementation Report

Ngày xác minh: 2026-07-17

## 1. Architecture

- Route `/cart` tiếp tục nằm trong `app/(customer)` và dùng `CustomerLayout` dùng chung.
- `CartPage` là Server Component: lấy actor hiện tại bằng `requirePageActor()` và đọc giỏ hàng thật qua `getCart()`.
- `CartView` là Client Component duy nhất quản lý tương tác quantity/remove. State chỉ được thay bằng cart DTO đầy đủ mà server trả về sau mutation thành công.
- Không thay đổi backend, API contract, Prisma schema, authentication, authorization, order hoặc payment logic.

## 2. API Integration

| Hành vi | API hiện có | Cách UI sử dụng |
| --- | --- | --- |
| Tải cart | `GET /api/v1/cart` qua `getCart()` | Server render, giữ nguyên customer guard |
| Tăng/giảm quantity | `PATCH /api/v1/cart/items/[id]` | Gửi `{ quantity }`, chờ server trả cart mới |
| Xóa item | `DELETE /api/v1/cart/items/[id]` | Chờ server xác nhận trước khi xóa khỏi UI |
| Checkout | `/checkout` | Chỉ điều hướng; giá, tồn kho và khu vực được server xác nhận lại |

Guest vẫn bị chuyển đến `/login`; role enforcement vẫn do server hiện tại thực hiện.

## 3. Components Created

- `src/components/commerce/cart-item.tsx`: item thiết bị, biến thể, availability, gói lắp đặt, quantity controls, đơn giá, subtotal và remove action.
- `src/components/commerce/cart-view.tsx`: confirmed cart state, mutation/loading/error handling, empty state, installation summary và price sidebar.
- `app/(customer)/cart/loading.tsx`: loading state của route.
- `tests/e2e/cart.spec.ts`: cart data thật, quantity, remove, package, empty state và responsive layout.

## 4. Price Calculation Flow

1. Server cart service đọc lại `ProductVariant.priceVnd` và `ServicePackage.priceVnd` từ database.
2. DTO trả các giá trị tiền dưới dạng decimal string.
3. UI dùng `BigInt` để cộng/nhân các giá trị VND nguyên, tránh mất chính xác của JavaScript `Number`.
4. `Thiết bị`, `Gói lắp đặt` và `Tạm tính` chỉ được suy ra từ DTO server mới nhất; client không thêm phí hoặc chấp nhận total từ input người dùng.
5. Checkout vẫn là nguồn sự thật cuối cùng cho giá, tồn kho, phí giao hàng, khu vực phục vụ và lịch lắp đặt.

## 5. UX Decisions

- Desktop dùng cart list và sticky summary sidebar; tablet/mobile xếp summary xuống dưới.
- Quantity giới hạn 1-99 theo contract; button ở biên và item đang mutation bị disabled.
- Không optimistic update: dữ liệu cũ được giữ nguyên nếu server từ chối.
- Lỗi conflict, rate limit và lỗi mutation có thông báo tại vùng cart.
- Empty state có icon, thông điệp `Giỏ hàng của bạn đang trống` và CTA `Khám phá sản phẩm`.
- Button có accessible name; quantity dùng `output`; media fallback có accessible label.
- Đã kiểm tra trực quan ở 390, 768 và 1440 px; không có horizontal overflow trong vùng cart.

## 6. Test Results

Final gates chạy trên source hiện tại với PostgreSQL/MinIO local và Playwright dev server mới:

| Command | Kết quả |
| --- | --- |
| `pnpm lint` | PASS, 0 warnings |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 19 files / 70 tests |
| `pnpm test:integration` | PASS, 7 files / 53 tests |
| `pnpm test:e2e` | PASS, 33/33 |
| `pnpm build` | PASS, Next.js production build |

Regression E2E cart chứng minh:

- Customer Header và route layout hiển thị.
- Product/variant thật và installation package thật xuất hiện.
- Quantity update dùng API và hiển thị cart server trả về.
- Remove trả về empty state.
- Empty cart có CTA.
- Bố cục 390/768/1440 không tràn ngang và summary đổi vị trí đúng breakpoint.

Lần chạy full E2E đầu tiên thất bại 4 test vì Docker app image cũ đang chiếm port 3000 và Playwright local cho phép reuse server; product-detail đồng thời dùng chung tài khoản demo đã đạt login rate limit. Sau khi dừng container cũ và cô lập customer fixture của product-detail, lần chạy `pnpm test:e2e` mới trên source hiện tại pass 33/33. Không giảm hoặc bypass rate limit.

Kiểm tra residue database sau test không tìm thấy user có namespace `cart-e2e-*` hoặc `product-detail-e2e-*`.

## 7. Known Limitations

- Cart API hiện không trả product image/slug, SKU hoặc product name và variant name tách riêng. UI dùng placeholder trung tính, hiển thị combined name và variant ID; không truy vấn database trực tiếp hay tạo media/SKU giả.
- Cart API chưa có cart-level authoritative total trước khi chọn địa chỉ. Tạm tính chỉ tổng hợp giá thiết bị/gói do server trả về; shipping và service-area fees chỉ xuất hiện tại checkout.
- Next.js dev server phát advisory warning về `scroll-behavior: smooth` trong route transitions; warning không làm gate thất bại và không thuộc phạm vi cart.
- Khi chạy E2E local, cần bảo đảm không có Docker app cũ chiếm port 3000 để Playwright kiểm tra đúng source hiện tại.

## Final Status

**CART READY**
