## 2026-07-24

### Tính năng mới / Cải thiện
- Tổ chức lại UI danh sách học sinh đã mua khóa học vào một modal (`EnrollmentListModal`) mở ra từ màn chi tiết khóa học gốc thay vì hiển thị trực tiếp bên dưới.
- Tùy chỉnh màu sắc nút bấm ("Học sinh đã mua" sử dụng class `theme-button-primary` để nổi bật).
- Hiển thị động tiêu đề ("Chi tiết khóa học cá nhân hóa" vs "Chi tiết khóa học") dựa theo loại của khóa học (`path.kind`).
- Đồng bộ giao diện form trong modal, đảm bảo danh sách bộ lọc (`OptionField`) không bị che lấp bằng cách set `min-height` cho modal.
- Cập nhật logic API lấy chi tiết khóa học public (`public-learning-paths.service.ts`): Nếu học sinh đang truy cập khóa học gốc nhưng có bản khóa học cá nhân (chứa `deliveryLearningPathId`), hệ thống sẽ tự động trích xuất các chương, bài học và tiến độ tương ứng từ bản cá nhân để trả về thay thế, nhưng vẫn giữ lại các thông tin chung của bản gốc (tên, mô tả, giá).

### File thay đổi
- `apps/web/features/admin/courses/screens/admin-course-detail-manager/index.tsx`
- `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/enrollment-list-panel.tsx`
- `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/enrollment-list-modal.tsx` (Mới)
- `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/personal-path-banner.tsx` (Mới)
- `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/clone-status-badge.tsx` (Mới)
- `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/create-personal-path-confirm-dialog.tsx` (Mới)
- `apps/web/features/admin/courses/hooks/use-enrollment-list-panel.ts` (Mới)
- `apps/web/features/admin/courses/api/admin-personal-learning-paths-api.ts` (Mới)
- `apps/api/src/modules/learning-paths/services/public-learning-paths.service.ts`
- `apps/api/src/modules/learning-paths/types/learning-path.types.ts`
- `apps/web/components/admin/courses/editor-dialog-shell.tsx`
- `apps/web/app/(admin)/admin/courses/[id]/page.tsx`
- `apps/web/features/admin/courses/admin-courses-data.ts`
- `apps/web/features/admin/courses/mappers/admin-course-api-mappers.ts`
- `apps/web/features/admin/courses/types/admin-course-api-types.ts`

### Tính năng mới / Cải thiện
- [M5.4] Triển khai Hybrid Search kết hợp Vector Search và Keyword Search nhằm tăng độ chính xác khi truy xuất các công thức toán học, ký hiệu đặc thù (`\frac`, `cm²`, `∑`), cấu hình hạn mức token (budget cap) trả về.
- Tích hợp bộ tiền xử lý `extractKeywords()` sử dụng regex chuyên sâu phân tích câu hỏi người dùng thành mảng từ khóa để chạy tìm kiếm `ILIKE` song song bằng Postgres.
- Tinh chỉnh Integration Tests cho hybrid search: xử lý nghiêm ngặt Prisma constraints (`FilePurpose`, `bucket`, `objectKey` unique) và dùng API mock để vượt quá giới hạn Rate limit của OpenAI.

### File thay đổi
- `apps/api/src/modules/ai/services/retrieval.service.ts`
- `apps/api/src/modules/ai/types/retrieval.types.ts`
- `apps/api/src/modules/ai/utils/keyword-extractor.ts` (Mới)
- `apps/api/test/m5.3-retrieval.test.ts`
- `apps/api/test/m5.4-hybrid-search-live.int.test.ts` (Mới)
- `apps/api/test/m5.4-keyword-extractor.test.ts` (Mới)
