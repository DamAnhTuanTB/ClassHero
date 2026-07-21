## 2026-07-21

### Thêm mới (Added)
- Hỗ trợ lưu trữ và xác nhận nhãn trang in (`printedPageLabel`, `printedPageNumber`) cho từng trang OCR.
- Tích hợp `MathpixMarkdownRenderer` để render trực tiếp kết quả Mathpix OCR dạng markdown (thay thế HTML iframe).
- Thêm chức năng tìm kiếm trang OCR theo nhãn/số trang in trong `SourceDocumentPagesDialog`.
- API endpoints và DTO (`confirm-printed-page.dto.ts`) để admin xử lý xác nhận trang in.

### Cập nhật (Changed)
- Cập nhật UI modal Xem trang OCR để render từng trang rõ ràng, bổ sung nút chuyển đổi hiển thị "Từng trang" và "Toàn bộ".
- Tên file trong phần quản lý tài liệu nguồn giờ đây có thể bấm vào (clickable) để mở trực tiếp PDF.
- Tên file quá dài sẽ tự động được thu gọn (`truncate`) thay vì bẻ dòng gây vỡ layout, bổ sung thuộc tính `title` để hiển thị đầy đủ khi hover.
- Nút "Xem trang" bị vô hiệu hóa một cách chính xác khi tài liệu nguồn đang trong quá trình xử lý (chạy processing/OCR).

### Sửa lỗi (Fixed)
- Sửa lỗi vòng lặp render vô hạn (Maximum update depth exceeded) trong React do lỗi cấp phát reference mảng mới mỗi lần render của mảng `useQuery` ở trạng thái fallback (`?? []`). Thay thế bằng `EMPTY_ARRAY` cố định.
- Sửa lỗi độ rộng modal thêm buổi học chưa khớp với độ rộng chuẩn của trang PDF.
