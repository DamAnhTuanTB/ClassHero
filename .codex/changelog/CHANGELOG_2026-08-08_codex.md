# 2026-08-08

## M18 - AI Features & Provider Operations

### Features & Fixes
- **Admin AI Settings - Usage Cost UI Updates**:
  - Sửa lại tiêu đề và cách gộp nhóm chi phí trong `usage-cost-tab.tsx`: gộp theo model thay vì feature.
  - Sửa hiển thị của nhóm Mathpix để không thể mở rộng (expand) vì không có các model con.
  - Sửa lại bảng "Lượt sử dụng gần đây" thành "Tất cả lượt sử dụng" và bổ sung phân trang (sử dụng thuộc tính `events.pagination`).
  - Đổi nhãn hiển thị thành "Uncached Prompt Tokens" thay cho "Prompt Tokens" để tránh nhầm lẫn về tổng token và token dùng tính phí.
  - Gỡ bỏ định dạng viết tắt (compact) trong hàm `formatNumber` của `provider-operations-formatters.ts` để hiển thị con số token chính xác tuyệt đối, giúp người dùng có thể tự đối chiếu và nhân giá trị để kiểm tra chi phí.

- **Admin AI Settings - Provider Configurations**:
  - Thêm tuỳ chọn "Không dùng" trong danh sách mô hình của nhà cung cấp.
  - Giữ nguyên tab đang xem khi người dùng F5 hoặc tải lại trang.
  - Xóa bỏ tab "Đọc tài liệu" (không còn sử dụng) và tinh chỉnh giao diện các nhãn dịch vụ.
  
- **Admin AI Generation - Lesson Summary**:
  - Tích hợp 3 chế độ xem nội dung kiến thức (Chỉ xem UI, Chỉ xem JSON, Xem song song) và mặc định là Chỉ xem UI.
  - Cập nhật trình soạn thảo JSON có tính năng thu/mở rộng mã (collapse/expand) và đồng bộ trực tiếp với trình xem UI.
  - Sửa lỗi nhấn "Lưu nội dung" tự động chuyển bài viết đã được "Phát hành" (APPROVED) trở về "Bản nháp" (DRAFT).

- **Student Interface & Rendering**:
  - Hiển thị nội dung phần "Kiến thức buổi học" ở giao diện học sinh sử dụng `SummaryBlockRenderer`.
  - Cập nhật giao diện khối công thức toán Mathpix: bỏ viền và nền xám dư thừa để UI sạch và đồng nhất hơn.
