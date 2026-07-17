# Lesson Document Processing

## Tính năng này giải quyết gì?

MVP không upload từng file rời rạc cho từng chương. Admin tạo sẵn lesson metadata, upload một PDF/tài liệu nguồn dài ở cấp lộ trình, rồi gán khoảng trang cho từng lesson. Lesson vẫn có thể có tài liệu bổ sung riêng, nhưng mọi chunk/embedding về sau phải gắn với `lesson_id`.

## Bức tranh tổng thể

`M4.2` tạo lớp API và database mapping. API biết tài liệu nguồn, trang, page range và lesson document nào cần xử lý. `M4.3` nối BullMQ worker foundation: API enqueue durable job row vào Redis/BullMQ, worker chạy tách API nhận job và cập nhật `background_jobs`. `M4.4` mới thay processor foundation bằng extract/OCR và chunk thật.

## Sơ đồ luồng dễ hiểu

```mermaid
flowchart TD
  A[Admin upload PDF qua Files API] --> B[Tạo source document cấp lộ trình]
  B --> C[Tạo DOCUMENT_PROCESSING job row]
  C --> D[API enqueue BullMQ job]
  D --> E[Worker M4.3 cập nhật job status]
  E --> F[Worker M4.4 extract/OCR từng trang]
  F --> G[Admin gán page range cho lesson]
  G --> H[Tạo/cập nhật lesson document chính]
  H --> I[Tạo job chunk theo lesson_id]
  J[Admin upload supplemental] --> K[Tạo lesson document bổ sung]
  K --> I
  I --> L[Worker chunk/embedding ở M4.4/M5]
```

## Luồng code end-to-end

1. Admin upload PDF bằng `POST /files/upload` với `purpose = LESSON_DOCUMENT`.
2. Admin tạo source document bằng `POST /admin/learning-paths/:learningPathId/source-documents`.
3. API lưu `source_documents`, set status processing và tạo `background_jobs` queue `DOCUMENT_PROCESSING`.
4. Sau khi transaction commit, `BackgroundJobQueueService` enqueue job vào BullMQ và lưu `bullmq_job_id`.
5. Worker document-processing nhận job, set `RUNNING`, ghi `attempts/started_at`, rồi foundation processor set `SUCCEEDED` với `result_json` an toàn.
6. Ở `M4.4`, worker sẽ tạo `source_document_pages` khi biết số trang và text/thumbnail từng trang.
7. Admin gọi `PUT /admin/source-documents/:sourceDocumentId/lesson-page-ranges`.
8. API validate lesson cùng lộ trình, page range hợp lệ, cảnh báo overlap/gap, rồi tạo `lesson_document_page_ranges`.
9. API tạo hoặc cập nhật `lesson_documents` loại `PRIMARY_FROM_SOURCE` và tạo job chunking theo `lesson_id`.
10. Nếu admin thay tài liệu chính bằng file riêng, API tạo `PRIMARY_REPLACEMENT` và đánh dấu tài liệu chính cũ bằng `replaced_at`.
11. Nếu admin thêm tài liệu bổ sung, API tạo `SUPPLEMENT`; tài liệu bổ sung không làm mất tài liệu chính.

## Back-end/API

- Source document APIs nằm trong `LearningPathsModule`, controller `admin-source-documents`.
- Lesson document APIs nằm trong controller `admin-lesson-documents`.
- Job status nằm trong `JobsModule` qua `GET /jobs/:jobId`.
- Từ `M4.3`, document services vẫn tạo durable row trong DB trước, rồi gọi `BackgroundJobQueueService` sau transaction để enqueue BullMQ. Cách này giữ DB là nguồn trạng thái bền vững, còn Redis/BullMQ là kênh thực thi.

## Database

- `source_documents`: file nguồn dài cấp lộ trình.
- `source_document_pages`: text/status/quality từng trang, do worker tạo.
- `lesson_document_page_ranges`: mapping `lesson -> page_start/page_end`.
- `lesson_documents`: tài liệu học thật gắn với lesson, có `kind`.
- `replaced_at`: đánh dấu tài liệu chính cũ, giúp mỗi lesson chỉ có một tài liệu chính active mà không xóa lịch sử ngay.

## Worker/AI/Integration

`M4.3` đã nối BullMQ worker foundation. API và worker dùng chung queue name mapping, Redis connection parser và durable `background_jobs`.

Worker foundation hiện làm ba việc:

- Nhận job từ Redis/BullMQ bằng `backgroundJobId`.
- Cập nhật DB status `QUEUED -> RUNNING -> SUCCEEDED/FAILED`, kèm `attempts`, `error_message`, `started_at`, `finished_at`.
- Ghi result placeholder để chứng minh worker đã nhận job; extract/OCR/chunk thật vẫn thuộc `M4.4`.

`M4.4` sẽ extract/OCR và chunk. `M5.x` mới tạo embedding bằng pgvector. Vì vậy foundation worker không gọi AI và không parse PDF thật.

## File quan trọng

- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/learning-paths/services/source-documents.service.ts`
- `apps/api/src/modules/learning-paths/services/lesson-documents.service.ts`
- `apps/api/src/modules/jobs/services/background-job-queue.service.ts`
- `apps/api/src/modules/jobs/services/jobs.service.ts`
- `apps/api/src/jobs/background-job-queues.ts`
- `apps/api/src/workers/processors/document-processing.processor.ts`
- `apps/api/src/workers/services/document-processing-worker.service.ts`
- `docs/database/files-documents.md`
- `docs/api/learning-paths-lessons.md`

## Kiến thức cần nhớ

- Source document là nguồn để extract/OCR theo trang, không dùng trực tiếp cho student retrieval.
- Retrieval/RAG sau này phải filter theo `lesson_id`, nên chunk cuối cùng luôn gắn với lesson.
- Tài liệu chính và tài liệu bổ sung là hai luồng khác nhau; thay tài liệu chính không được xóa supplemental.
- `background_jobs.id` là `jobId` cho UI poll và cũng được dùng làm BullMQ `jobId` để enqueue idempotent hơn.
- DB giữ trạng thái durable để UI xem được kể cả khi worker/Redis restart; BullMQ chỉ là nơi xếp hàng và chạy job.

## Task liên quan

- `M4.1`: FilesModule và storage service.
- `M4.2`: Source document và lesson page mapping API.
- `M4.3`: BullMQ worker foundation.
- `M4.4`: PDF extract và chunking.
- `M4.5`: Lesson document upload UI/status.
