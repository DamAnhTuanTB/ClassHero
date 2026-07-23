# ADR-0009 - Lesson document kind taxonomy

Date: 2026-07-23
Status: Accepted

## Context

Hệ thống từng dùng `PRIMARY_REPLACEMENT` để phân biệt tài liệu nền tảng được upload thay thế với tài liệu nền tảng tạo từ source document và page range. Cách phân loại này trộn hai khái niệm: vai trò của tài liệu trong lesson và hành động/nguồn tạo tài liệu. Đồng thời luồng bài tập về nhà đã cần một kind riêng nhưng enum và tài liệu nguồn chưa đồng nhất.

## Decision

`LessonDocumentKind` chỉ có đúng ba giá trị:

- `PRIMARY_FROM_SOURCE`: Tài liệu nền tảng.
- `SUPPLEMENT`: Tài liệu bổ sung.
- `HOMEWORK`: Tài liệu bài tập về nhà.

Mọi tài liệu nền tảng active đều dùng `PRIMARY_FROM_SOURCE`. Một lesson có thể có nhiều tài liệu nền tảng từ source page ranges và nhiều file nền tảng upload trực tiếp. Nguồn gốc, page range và lịch sử thay thế được biểu diễn bằng `source_document_id`, `page_range_id`, metadata và `replaced_at`; không tạo thêm kind.

Dữ liệu cũ có `kind = PRIMARY_REPLACEMENT` được migrate sang `PRIMARY_FROM_SOURCE`.

## Consequences

- Frontend, API, Prisma schema, database constraint và test dùng cùng một tập ba kind.
- Partial unique index giới hạn một `PRIMARY_FROM_SOURCE` active cho mỗi lesson và unique `(lesson_id, source_document_id)` đều được bỏ.
- API/UI cho phép nhiều khối trích xuất; chỉ cấm các range giao nhau trong cùng source document. Mỗi khối liên kết với document qua `page_range_id`.
- Thay/xóa một page range chỉ archive document liên quan bằng `replaced_at`; các khối khác và file nền tảng upload trực tiếp là additive.
- Migration lịch sử đã phát hành vẫn được giữ nguyên; migration tiến tới chịu trách nhiệm chuyển dữ liệu và thu gọn PostgreSQL enum.
