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

- 2026-07-23: Mở rộng quản lý tài liệu khóa học và buổi học với nhiều tài liệu nguồn, nhiều khối trích xuất có thứ tự, nhiều file nền tảng/bổ sung/bài tập về nhà, chuẩn hóa ba document kind, trạng thái sẵn sàng và validation khoảng trang; đồng thời bổ sung kiểm tra trùng tên buổi học trong cùng chương ở cả API và modal quản trị.
- 2026-07-23: Sửa modal chỉnh sửa buổi học bị nhân đôi khối trích xuất sau một lần thêm, chuẩn hóa lỗi thiếu tài liệu nguồn thành thông báo nghiệp vụ và bổ sung regression test cho luồng thêm trích xuất rồi áp dụng gợi ý trên desktop, tablet và mobile.
- 2026-07-23: Chuẩn hóa thuật ngữ giao diện từ “bài học” sang “buổi học”, sắp xếp lại modal thêm tài liệu nguồn và bổ sung thống kê tài liệu đã gán với modal chi tiết, khoảng trang cùng preview OCR/PDF dùng chung.
- 2026-07-23: Bổ sung loại buổi học cơ bản/live xuyên suốt Prisma, Lesson API và modal quản trị, hỗ trợ link học live tùy chọn với validation và tự clear cho buổi cơ bản, đồng thời thêm badge Live màu tím dễ phân biệt trong danh sách cùng tài liệu và kiểm thử liên quan.
- 2026-07-23: Triển khai M3.6 – Personal Learning Path Clone: thêm enum `LearningPathKind` (CATALOG/PERSONALIZED), mô hình dữ liệu clone lộ trình và chương (sourceLearningPathId, sourceChapterId, kind), migration SQL, background job queue `PERSONAL_LEARNING_PATH_CLONE`, worker processor/cloner, API admin (GET enrollments của lộ trình, POST tạo personal copy), serializer/selector riêng, ADR-0010. Đồng thời chuẩn hóa bộ lọc khám phá khóa học (grade/subject/query) sang URL search params qua hook `useFilterSearchParams` để giữ state khi navigate.
