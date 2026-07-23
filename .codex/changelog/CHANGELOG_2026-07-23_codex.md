# Changelog 2026-07-23

## Fix Bug Không Thể Xóa Khoảng Trang Tài Liệu Nền Tảng

- **Frontend:**
  - Cập nhật payload `AdminLessonPayload` để cho phép `sourceDocumentPageRange` có thể nhận giá trị `null`.
  - Thay đổi logic trong `admin-course-api-payloads.ts` để khi người dùng nhấn xóa khoảng trang (làm ẩn khối nhập liệu), form sẽ truyền `sourceDocumentPageRange: null` lên API.
  - Sửa lỗi căn lề (CSS) của icon thùng rác trong `lesson-source-range-section.tsx`: trên màn hình desktop sử dụng `sm:mt-7` (tương đương 28px) để căn thẳng lề với phần input, trên điện thoại giữ `mt-0` để không bị dư khoảng trống quá xa.

- **Backend:**
  - Cập nhật `UpdateLessonDto` thêm rule cho phép giá trị `null` đối với trường `sourceDocumentPageRange`.
  - Bổ sung logic vào `lessons.service.ts`: nếu `dto.sourceDocumentPageRange === null`, gọi service để xóa hoàn toàn sự liên kết trang nền tảng của bài học.
  - Bổ sung phương thức `removeSingleLessonPageRangeInTransaction` vào `source-documents.service.ts` để xóa cứng dữ liệu trong bảng `LessonDocumentPageRange` và cập nhật xóa mềm bằng `replacedAt` cho `LessonDocument`.
