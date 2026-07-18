# Product Image Generation Report

## Kết quả audit

Frontend lấy catalog thật qua module catalog và ưu tiên ảnh do backend trả về. Database local có 12 sản phẩm demo đang hoạt động; tại thời điểm audit, cả 12 đều có `images: []`. Không có giá, SKU, tồn kho, biến thể, gói lắp đặt hay business data nào được tạo hoặc sửa trong công việc này.

Ảnh demo được tích hợp bằng manifest frontend theo `product.slug`. Nếu API trả về ảnh, `ProductCard` và `ProductGallery` tiếp tục ưu tiên ảnh API. Fallback chỉ áp dụng cho slug có trong manifest.

## Asset được tạo

Mỗi sản phẩm có một ảnh chính và ba ảnh gallery, định dạng PNG 611 x 611 px, ánh sáng studio trung tính, tập trung vào sản phẩm. Tất cả URL bắt đầu bằng `/assets/images/products/` và file vật lý nằm trong `public/assets/images/products/`.

| Product | Category | Variant / SKU | Files |
| --- | --- | --- | --- |
| Camera ngoài trời C1 | SECURITY_CAMERA | Bản tiêu chuẩn / CAM-C1-WHT | `camera-ngoai-troi-c1.png`, `camera-ngoai-troi-c1_1.png`, `camera-ngoai-troi-c1_2.png`, `camera-ngoai-troi-c1_3.png` |
| Camera trong nhà C2 | SECURITY_CAMERA | Bản quay quét / CAM-C2-WHT | `camera-trong-nha-c2.png`, `camera-trong-nha-c2_1.png`, `camera-trong-nha-c2_2.png`, `camera-trong-nha-c2_3.png` |
| Camera pin C3 | SECURITY_CAMERA | Bản dùng pin / CAM-C3-BLK | `camera-pin-c3.png`, `camera-pin-c3_1.png`, `camera-pin-c3_2.png`, `camera-pin-c3_3.png` |
| Chuông cửa D1 | VIDEO_DOORBELL | Bản có chuông / DB-D1-WHT | `chuong-cua-d1.png`, `chuong-cua-d1_1.png`, `chuong-cua-d1_2.png`, `chuong-cua-d1_3.png` |
| Chuông cửa D2 | VIDEO_DOORBELL | Bản góc rộng / DB-D2-BLK | `chuong-cua-d2.png`, `chuong-cua-d2_1.png`, `chuong-cua-d2_2.png`, `chuong-cua-d2_3.png` |
| Chuông cửa D3 | VIDEO_DOORBELL | Bản kèm màn hình / DB-D3-GRY | `chuong-cua-d3.png`, `chuong-cua-d3_1.png`, `chuong-cua-d3_2.png`, `chuong-cua-d3_3.png` |
| Mesh Wi-Fi M1 | MESH_WIFI | Bộ 2 cục / MESH-M1-2P | `mesh-wifi-m1.png`, `mesh-wifi-m1_1.png`, `mesh-wifi-m1_2.png`, `mesh-wifi-m1_3.png` |
| Mesh Wi-Fi M2 | MESH_WIFI | Bộ 3 cục / MESH-M2-3P | `mesh-wifi-m2.png`, `mesh-wifi-m2_1.png`, `mesh-wifi-m2_2.png`, `mesh-wifi-m2_3.png` |
| Mesh Wi-Fi M3 | MESH_WIFI | Bộ 3 cục Pro / MESH-M3-3P | `mesh-wifi-m3.png`, `mesh-wifi-m3_1.png`, `mesh-wifi-m3_2.png`, `mesh-wifi-m3_3.png` |
| Khóa cửa L1 | SMART_LOCK | Bản mã số / LOCK-L1-BLK | `khoa-cua-l1.png`, `khoa-cua-l1_1.png`, `khoa-cua-l1_2.png`, `khoa-cua-l1_3.png` |
| Khóa cửa L2 | SMART_LOCK | Bản vân tay / LOCK-L2-BLK | `khoa-cua-l2.png`, `khoa-cua-l2_1.png`, `khoa-cua-l2_2.png`, `khoa-cua-l2_3.png` |
| Khóa cửa L3 | SMART_LOCK | Bản kết nối app / LOCK-L3-GRY | `khoa-cua-l3.png`, `khoa-cua-l3_1.png`, `khoa-cua-l3_2.png`, `khoa-cua-l3_3.png` |

## Cách sinh ảnh

Ảnh được sinh bằng built-in image generation ở chế độ tạo mới. Mỗi sản phẩm dùng một prompt riêng mô tả đúng category, màu sắc và cấu hình variant; đầu ra là contact sheet 2 x 2 nhất quán gồm hero, front, detail và in-context view. Các ô sau đó được cắt cơ học thành bốn PNG độc lập, không dùng AI để sửa business data hoặc nội dung giao diện.

Prompt chung: realistic premium ecommerce product photography, neutral light-gray studio background, soft daylight, accurate material detail, no logo, no text, no watermark, consistent product across four views, mobile and desktop friendly framing. Chi tiết loại thiết bị, màu và số lượng node/phụ kiện được thay theo từng variant trong bảng trên.

## Tích hợp frontend

- `src/components/catalog/product-demo-images.ts`: ánh xạ slug sang URL và alt text.
- `src/components/catalog/product-card.tsx`: dùng ảnh chính demo khi API không có ảnh.
- `src/components/catalog/product-gallery.tsx`: dùng bốn ảnh demo khi API trả gallery rỗng.
- `app/(customer)/products/[slug]/page.tsx`: truyền slug vào gallery; không đổi query hoặc DTO.

## Xác minh

- Unit test kiểm tra đủ 12 slug, đúng bốn path và alt text cho mỗi sản phẩm.
- E2E kiểm tra ảnh tải thành công ở homepage, product listing và product detail.
- Product detail E2E kiểm tra đủ bốn thumbnail.
- Responsive suite hiện có kiểm tra các viewport 390, 768 và 1440 px, bao gồm horizontal overflow.

### Kết quả quality gates trên trạng thái cuối

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS, 0 warning/error |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS, 25 files / 85 tests |
| `pnpm test:integration` | PASS, 9 files / 63 tests |
| `pnpm test:e2e` | PASS, 44/44 Chromium tests, chạy lại sau thay đổi UI cuối |
| `pnpm build` | PASS, Next.js production build hoàn tất |

Visual QA bằng Chromium xác nhận product listing và product detail hiển thị ảnh ở desktop 1440 x 900 và mobile 390 x 844, không có horizontal overflow. Ảnh fallback dùng `object-contain` để giữ trọn thiết bị dạng dọc; ảnh API vẫn giữ presentation hiện hữu.

## Rủi ro còn lại

Đây là asset demo được quản lý trong frontend. Khi có ảnh catalog chính thức, nên upload qua cơ chế product image hiện có để backend trở thành nguồn ảnh duy nhất; fallback sẽ tự nhường ưu tiên cho ảnh API mà không cần thay đổi business logic.
