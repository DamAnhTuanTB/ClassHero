# 2026-07-21
## Admin Course Manager
- **Source Document Dialog**:
  - Thêm nút (x) để xóa nhanh kết quả tìm kiếm số trang in.
  - Triển khai phân trang lười (Lazy loading / Infinite scroll) sử dụng `IntersectionObserver`, mỗi lần tải 10 trang, khắc phục tình trạng giật/lag giao diện (UI delay) khi phải render hàng trăm trang OCR cùng lúc.
  - Sửa lỗi state tìm kiếm trang in: Tự động reset giá trị ô tìm kiếm về trống mỗi khi đóng và mở lại modal.
- **Lesson Editor Validation**:
  - Thêm xác thực logic `pageEnd >= pageStart` bằng Zod `superRefine` trong `admin-courses-schemas.ts`. Hiển thị cảnh báo trực tiếp (real-time error) nếu người dùng nhập số trang kết thúc nhỏ hơn trang bắt đầu.
- **Toast Notifications**:
  - Khắc phục lỗi "click xuyên qua" (click pass-through) trên thông báo toast bằng cách đổi `pointer-events: none` thành `pointer-events: auto` cho `.app-toast` trong `globals.css`.
- **Workflow & Rules**:
  - Bổ sung quy tắc 2.4 vào `AGENTS.md`: Bắt buộc khởi động lại tiến trình worker (`pnpm dev`) sau khi sửa đổi các tệp trong `apps/api/src/workers/*` để code mới được áp dụng.
