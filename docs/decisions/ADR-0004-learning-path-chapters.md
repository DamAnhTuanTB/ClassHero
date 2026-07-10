# ADR-0004 - Learning path chapters

Date: 2026-07-10
Status: Accepted

## Context

Ban đầu tài liệu mô tả lộ trình học gồm trực tiếp nhiều buổi học. Owner cập nhật cấu trúc sản phẩm: mỗi lộ trình học gồm các chương học, mỗi chương học gồm các buổi học.

Sau khi làm rõ, chương học chỉ chứa thông tin tổng quan để nhóm nội dung, không phải một đơn vị học chi tiết.

## Decision

Mô hình nội dung chính là:

```txt
learning path -> chapter -> lesson
```

Chapter chỉ chứa metadata/tổng quan:

- Tên chương.
- Thứ tự trong lộ trình.
- Mô tả/tổng quan ngắn.
- Mục tiêu học tập hoặc nội dung trọng tâm nếu admin nhập.
- Trạng thái hiển thị.

Chapter không có video, tài liệu/PDF riêng, lesson summary riêng, quiz, flashcard hoặc test. Các nội dung học chi tiết này chỉ nằm ở lesson.

## Consequences

- Database cần thêm `learning_path_chapters`; `lessons` thuộc `chapter_id`.
- API course detail cần trả cây `chapters -> lessons`.
- Admin UI cần quản lý chapter trong màn chi tiết lộ trình trước khi quản lý lesson.
- File upload, document chunks, RAG, AI generation, quiz, flashcard, test, progress và chat vẫn gắn với lesson.
- Các task M1.3, M3.2, M3.4, M3.5 là nhóm bị ảnh hưởng trực tiếp.
