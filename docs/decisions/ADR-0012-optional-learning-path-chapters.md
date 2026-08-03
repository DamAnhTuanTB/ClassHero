# ADR-0012 - Optional learning path chapters

Date: 2026-08-03
Status: Accepted

## Context

Luồng hiện tại bắt admin tạo chapter trước rồi mới tạo được lesson. Điều này không phù hợp với khóa học chỉ cần danh sách buổi học, đồng thời biến một lớp nhóm nội dung thành điều kiện bắt buộc của đơn vị học.

## Decision

Lesson luôn thuộc một learning path và có thể không thuộc chapter nào:

```txt
learning path (ordered top-level)
├── lesson
├── chapter
│   ├── lesson
│   └── lesson
├── lesson
└── chapter
```

- `lessons.learning_path_id` là quan hệ bắt buộc và source of truth của khóa học.
- `lessons.chapter_id` nullable. Nếu có, chapter phải thuộc cùng learning path.
- Admin có thể thêm chapter hoặc lesson trực tiếp từ course detail; lesson có thể chuyển tới bất kỳ vị trí nào trong cùng chapter, chapter khác hoặc top-level.
- Order/title unique theo nhóm đích. Nhóm đích là một chapter hoặc nhóm lesson không thuộc chapter của learning path.
- Chapter và lesson không thuộc chapter dùng một logical order top-level chung nên có thể xen kẽ tùy ý. Lesson trong chapter dùng order riêng trong chapter.
- Move là thao tác transaction: compact container nguồn, shift container đích và cập nhật `chapter_id`/`order_index` atomically.
- Sau move, lesson đang di chuyển không được đứng trước bất kỳ lesson khác đã có ít nhất một `lesson_progress = COMPLETED`; đây là guard backend để bảo toàn thứ tự lịch sử học.
- Chapter tiếp tục chỉ chứa metadata/tổng quan; mọi nội dung học, tài liệu, quiz, flashcard, test, progress và AI vẫn gắn với lesson.

## Consequences

- Cần migration làm nullable `chapter_id`, partial unique index cho lesson top-level và invariant service cross-table vì chapter/lesson top-level nằm ở hai bảng nhưng chia sẻ logical order.
- API cần course-level create lesson, canonical `structureItems` và atomic move endpoint nhận container/vị trí đích.
- Admin UI cần hai CTA ngang hàng, empty state có hai lựa chọn, ordered tree và drag/drop cross-container kèm action thay thế cho mobile/keyboard.
- Student/public course detail, progress, first/next lesson, clone và lesson navigation phải tính cả lesson không thuộc chapter.
- Các task hiện có `M1.3`, `M3.2`, `M3.4`, `M3.5` được mở rộng; không tạo task code mới và không đổi dependency roadmap.
