# Kế hoạch triển khai bản lộ trình cá nhân

Ngày: 2026-07-23

## 1. Mục tiêu

Cho phép admin tạo một bản khóa học riêng tư từ khóa mà học sinh đã mua, chỉnh sửa độc lập toàn bộ cấu trúc/nội dung cho đúng học sinh đó, trong khi:

- Payment, enrollment, giá và doanh thu vẫn thuộc khóa gốc.
- Bản cá nhân không xuất hiện trong catalog và không thể mua.
- Student/parent chỉ thấy bản cá nhân khi có đúng ownership.
- Tiến độ trước khi cá nhân hóa không bị mất hoặc cộng thưởng lần hai.

## 2. Phạm vi MVP

Trong phạm vi:

- Một enrollment có tối đa một bản cá nhân đang được sử dụng.
- Clone khóa/chương/buổi học và nội dung quản trị liên quan.
- Admin chỉnh sửa bản cá nhân bằng editor hiện có.
- Chạy clone nền, có trạng thái pending/success/error/retry.
- Student học theo effective learning path.
- Parent linked xem read-only theo effective learning path.
- Sau activation, bản cá nhân trở thành curriculum chính thức, lâu dài của enrollment.

Không làm trong lượt tính năng này:

- Group/cohort curriculum cho nhiều học sinh.
- Nhiều bản cá nhân active đồng thời cho một enrollment.
- Quay lại/reset về khóa gốc sau khi bản cá nhân đã activation.
- Tự động merge/sync thay đổi từ khóa gốc sau khi fork.
- Merge thay đổi từ bản cá nhân ngược về khóa gốc.
- AI tự quyết định học sinh cần cá nhân hóa.

## 3. Mô hình dữ liệu dự kiến

### `LearningPath`

Thêm:

- `kind: CATALOG | PERSONALIZED`, default `CATALOG`.
- `sourceLearningPathId?: uuid`, bắt buộc với `PERSONALIZED`.

Quy tắc:

- Chỉ `CATALOG` được discovery, purchase và tạo enrollment.
- `PERSONALIZED` dùng slug nội bộ opaque, không public.

### `LearningPathChapter`

Thêm:

- `sourceChapterId?: uuid`.

### `Lesson`

Thêm:

- `sourceLessonId?: uuid`.

### `Enrollment`

Giữ:

- `learningPathId`: khóa catalog đã mua.

Thêm:

- `deliveryLearningPathId?: uuid unique`: bản thực tế được giao; null nghĩa là dùng khóa gốc.

Constraint/service invariant:

- Delivery path phải là `PERSONALIZED`.
- `delivery.sourceLearningPathId` phải bằng `enrollment.learningPathId`.
- Một delivery path không được gán cho nhiều enrollment.

## 4. Chính sách nhân bản

| Nhóm dữ liệu | Chính sách |
| --- | --- |
| Learning path/chapter/lesson metadata | Clone và giữ source lineage |
| Summary, quiz, flashcard, test definition | Deep-copy để admin sửa độc lập |
| Lesson material/document association | Clone association |
| File/R2 object | Reuse, không copy binary |
| OCR artifact/source pages | Reuse cache/artifact; không gọi paid OCR |
| Chunk/embedding | Reuse qua lineage hoặc rebuild từ cache, không re-OCR |
| Enrollment/payment | Không clone |
| Progress/attempt/note/comment/favorite | Không deep-copy; giữ ownership và resolve qua lineage |
| Audit log | Tạo record mới cho clone/activate/edit |

Clone job phải idempotent. Enrollment chỉ được update `deliveryLearningPathId` trong transaction cuối sau khi tất cả bước bắt buộc hoàn tất.

## 5. API dự kiến

- `GET /admin/learning-paths/:learningPathId/enrollments`
- `POST /admin/enrollments/:enrollmentId/personal-learning-path`
- `GET /admin/enrollments/:enrollmentId/personal-learning-path`
- Reuse `GET /jobs/:jobId` cho clone status.
- Reuse admin learning path/chapter/lesson CRUD với authorization/policy cho `PERSONALIZED`.
- Student course/lesson API resolve `deliveryLearningPathId ?? learningPathId`.
- Parent API reuse effective resolver sau khi kiểm parent-child ownership.

Error tối thiểu:

- `PERSONAL_LEARNING_PATH_EXISTS`
- `PERSONAL_LEARNING_PATH_NOT_READY`
- `PERSONAL_LEARNING_PATH_ACCESS_DENIED`
- `PERSONAL_LEARNING_PATH_CLONE_FAILED`

## 6. UI dự kiến

### Admin

Trong course detail thêm `Học sinh đã mua`:

- Search/pagination học sinh.
- Trạng thái đang dùng khóa gốc/đang clone/đang dùng bản cá nhân.
- `Tạo bản cá nhân`.
- `Mở bản cá nhân`.
- Không có action quay lại/reset về khóa gốc.

Editor bản cá nhân reuse màn course detail hiện có, thêm banner:

- `Bản cá nhân`.
- Tên học sinh.
- Khóa nguồn.
- Cảnh báo không tự đồng bộ từ khóa gốc.

### Student

- Giữ URL/card của khóa đã mua.
- Detail và lesson navigation dùng cây effective.
- Hiển thị badge nhỏ `Lộ trình cá nhân`.
- Không hiển thị private slug/source ID.

### Parent

- Xem read-only cây effective của con đã chọn.
- Hiển thị badge `Lộ trình cá nhân`.

## 7. Tiến độ và lịch sử học

- Lesson clone có source lesson: khởi tạo/migrate progress summary từ source.
- Lesson hoàn toàn mới: `NOT_STARTED`.
- `xpAwarded` từ source phải được bảo toàn để chống cộng XP lần hai.
- Attempt/note/comment/favorite cũ không bị nhân bản thành record mới.
- API lịch sử dùng lineage để hiển thị dữ liệu trước khi fork.
- Progress percent và continue lesson tính theo published lessons của effective path.
- Mọi dữ liệu học tập mới sau activation được ghi theo lesson/content của bản cá nhân.
- Sau activation không clear hoặc đổi `deliveryLearningPathId`; admin sửa trực tiếp bản cá nhân.

## 8. Phân rã task

### `M3.6` — Personal learning path clone foundation

Mode: `Worker/Integration`

- Schema/migration/constraints/index.
- Clone matrix và clone job idempotent.
- Admin create/get API; activation một chiều.
- Audit, rollback và no-paid-OCR guarantee.

### `M3.7` — Admin personal learning path management UI

Mode: `UI + API`

- Enrollment list trong course detail.
- Clone confirmation/status/retry.
- Reuse editor với private banner.
- Không cung cấp revert/reset về khóa gốc.

### `M7.8` — Student personalized learning path access và progress

Mode: `UI + API`

- Effective path/access resolver.
- Progress/history/XP lineage.
- Student detail/lesson navigation/badge.

### `M11.5` — Parent personalized learning path view

Mode: `UI + API`

- Parent ownership.
- Effective course/progress read-only UI.

## 9. Thứ tự triển khai

1. `M3.6` schema + clone service/job + API.
2. `M3.7` admin flow tạo/chỉnh bản cá nhân.
3. `M7.8` student access/progress.
4. `M11.5` parent read view.
5. Regression/E2E cho catalog, payment, enrollment và progress.

Dependencies:

- `M3.6`: `M3.1`, `M3.2`, `M4.3`, `M8.3`.
- `M3.7`: `M3.4`, `M3.6`.
- `M7.8`: `M3.6`, `M7.1`, `M7.5`.
- `M11.5`: `M7.8`, `M11.1`, `M11.2`.

## 10. Test bắt buộc

Database/service:

- Constraint catalog/personalized/source/delivery.
- Một enrollment không tạo hai bản active khi request đồng thời.
- Clone failure không đổi delivery pointer.
- Sau activation không thể clear/đổi delivery pointer qua business API.

Permission/API:

- Personalized path không có trong public/explore.
- Không thể purchase/enroll personalized path.
- Student khác không truy cập được bằng ID.
- Parent khác không truy cập được.
- Admin edit clone không đổi base.

Progress:

- Giữ completed/best score hợp lệ từ source lesson.
- Lesson mới bắt đầu chưa học.
- Không cộng XP trùng.
- Denominator/continue lesson theo effective path.

Worker/performance:

- Retry idempotent.
- Không gọi paid OCR khi cache/artifact tồn tại.
- Có index cho source lineage và delivery lookup.

E2E:

- Admin clone → edit → student thấy nội dung riêng → student khác không thấy → mọi dữ liệu mới tiếp tục ghi trên bản custom.

## 11. Rollout và rollback

- Migration thêm field nullable/default nên không đổi behavior enrollment hiện có.
- Deploy schema/API trước; UI sau.
- Chỉ activation cuối mới đổi delivery pointer.
- Trước activation có thể hủy clone lỗi mà không ảnh hưởng enrollment.
- Sau khi đã có enrollment activation, rollback kỹ thuật phải theo hướng forward-fix và giữ đọc được bản cá nhân; không clear delivery pointer hàng loạt vì dữ liệu học tập mới đã phát sinh trên bản custom.

## 12. Quyết định và assumption

Đã chốt:

- Bản nhân chỉ thuộc một enrollment.
- Không phải sản phẩm bán mới.
- Không auto-sync từ khóa gốc trong MVP.
- Admin được chỉnh sửa độc lập.
- Activation là chuyển đổi một chiều, không có tính năng quay lại khóa gốc.

ASSUMPTION cần xác nhận khi bắt đầu `M3.6`:

- Khi admin sửa một lesson đã có student attempt, lịch sử cũ được giữ read-only theo lineage; attempt mới áp dụng nội dung của lesson clone.
