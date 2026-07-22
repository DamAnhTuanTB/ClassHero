# 2026-07-22
## Admin Course Manager
- **Course Documents**:
  - Ẩn phần hiển thị kết quả OCR khi tài liệu đang ở trạng thái xử lý (PROCESSING), giúp giao diện gọn gàng và tránh gây nhầm lẫn với các kết quả cũ của lần chạy trước.
  - Sửa lỗi "tài liệu phục sinh" (ghost document) khi xóa tài liệu: Tự động lưu trữ/xóa mềm (soft-delete) tất cả các bản ghi tài liệu chính cũ cùng lộ trình mỗi khi upload "Thay tài liệu chính". Điều này đảm bảo mỗi lộ trình chỉ có duy nhất một tài liệu chính hoạt động ở một thời điểm.
- **Terminology & UI Consistency**:
  - Đồng nhất ngôn từ: Đổi toàn bộ các cụm từ "sách nguồn", "tài liệu nguồn", "PDF nguồn" thành "**Tài liệu chính**" trên toàn bộ giao diện panel, các modal (upload, chọn khoảng trang, xem trước trang OCR), thông báo toast, và các hàm tiện ích liên quan.
