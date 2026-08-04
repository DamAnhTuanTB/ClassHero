# Database Background Jobs

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 10. Background jobs

### 10.1. `background_jobs`

Dùng để lưu trạng thái durable cho BullMQ jobs và phục vụ `GET /jobs/:jobId`.

```txt
id uuid pk
queue BackgroundJobQueue
status BackgroundJobStatus default QUEUED
bullmq_job_id string?
owner_user_id uuid? fk users.id
lesson_id uuid? fk lessons.id
resource_type string?
resource_id uuid?
input_meta_json jsonb?
result_json jsonb?
error_message text?
attempts int default 0
max_attempts int default 3
available_at timestamp?
started_at timestamp?
finished_at timestamp?
created_at timestamp
updated_at timestamp
```

Index:

- `bullmq_job_id`.
- `(owner_user_id, created_at)`.
- `(queue, status)`.
- `(resource_type, resource_id)`.

Rules:

- API trả `background_jobs.id` làm `jobId`.
- BullMQ job id có thể lưu ở `bullmq_job_id`.
- Không lưu secret hoặc raw prompt quá dài trong `input_meta_json`.
- `GET /jobs/:jobId` phải kiểm tra owner/role.
- `M4.2` tạo job rows cho `DOCUMENT_PROCESSING` khi tạo source document, cập nhật page range, thay thế tài liệu chính hoặc upload supplemental document; `M4.3` chịu trách nhiệm enqueue BullMQ thật và cập nhật `bullmq_job_id`.
- Từ `M4.3`, API enqueue job thật vào BullMQ sau khi DB transaction tạo durable row thành công. Worker chạy tách API, nhận job theo `bullmq_job_id`, cập nhật durable status `QUEUED -> RUNNING -> SUCCEEDED/FAILED`, ghi `attempts`, `started_at`, `finished_at`, `error_message` và `result_json` an toàn.
- `M9.12`: budget hard-limit/estimate-unavailable là terminal business error; worker không tăng retry cho lỗi này và durable job phải lưu safe error code để UI phân biệt với lỗi provider tạm thời.
- Processor `DOCUMENT_PROCESSING` ở `M4.3` mới là foundation: xác nhận worker nhận job và cập nhật trạng thái durable. Paid OCR artifact import/chunk tài liệu thật được triển khai ở `M4.4`.

---
