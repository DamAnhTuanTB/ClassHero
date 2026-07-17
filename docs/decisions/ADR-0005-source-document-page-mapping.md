# ADR-0005: Source Document Page Mapping For Lesson Documents

Date: 2026-07-17

## Status

Accepted

## Context

Tài liệu học thường đến từ sách/giáo trình PDF dài, có thể gồm nhiều bài học trong một file. Upload lẻ từng file cho từng buổi học đơn giản nhưng tốn thao tác và không khớp với nguồn tài liệu thật.

AI/RAG vẫn phải retrieval theo đúng `lesson_id`, nên hệ thống không được lưu chunks chung cho cả sách rồi để AI tự đoán bài học.

## Decision

Flow chính của MVP cho tài liệu buổi học là:

1. Admin tạo lesson bằng metadata thô trước.
2. Admin upload một source PDF/tài liệu dài ở cấp learning path/course.
3. Worker extract/OCR theo từng trang và lưu page text/status/quality.
4. Admin gán page range cho từng lesson.
5. Worker chunk nội dung theo từng lesson dựa trên page range đã xác nhận.
6. Retrieval/chat chỉ dùng chunks đã gắn `lesson_id`.

Upload tài liệu lẻ trực tiếp cho từng lesson được giữ làm supplemental document flow, không phải flow tài liệu chính.

## Consequences

- Cần model/API cho source document, source document pages và lesson page ranges.
- `M4.4` phải tách page-level extract/OCR khỏi lesson chunking.
- Khi page range đổi, chunks/embedding/explanation của lesson liên quan phải được tạo lại hoặc đánh dấu stale.
- UI `M4.5` cần màn gán trang theo lesson, không chỉ nút upload từng lesson.
- UI/API cần phân biệt tài liệu chính `PRIMARY_FROM_SOURCE` với tài liệu bổ sung `SUPPLEMENT`.
- Mỗi lesson cần action upload/thay thế tài liệu gốc; tài liệu chính mới có thể là page range khác hoặc file upload riêng, nhưng supplemental documents vẫn được giữ nguyên.
- Mỗi lesson cũng cần action upload tài liệu bổ sung riêng; action này không thay thế tài liệu gốc và không được dùng chung state với action tài liệu gốc.
- Retrieval theo lesson gom context từ cả tài liệu chính và tài liệu bổ sung, nhưng vẫn filter theo `lesson_id`.
