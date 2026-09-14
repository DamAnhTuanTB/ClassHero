# API Jobs

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 22. Job status API

### `GET /jobs/:jobId`

Role: authenticated.

Behavior:

- API đọc từ `background_jobs`.
- Student chỉ xem job do mình tạo.
- Parent chỉ xem job thuộc payment/child flow của mình nếu có.
- Admin xem mọi job.
- Không trả raw prompt hoặc secret trong result.
- Từ `M4.2`, API document tạo `background_jobs` queue `DOCUMENT_PROCESSING` để UI poll trạng thái; BullMQ worker thật được nối ở `M4.3`.
- Từ `M4.3`, job document được enqueue vào BullMQ thật sau khi API tạo durable row. Worker tách API cập nhật `status`, `attempts`, `startedAt`, `finishedAt`, `error` và `result`; document processing foundation chỉ xác nhận job chạy, còn paid OCR artifact import/chunk thật thuộc `M4.4`.
- Từ `M9.12`, `PROVIDER_BUDGET_HARD_LIMIT` và `PROVIDER_BUDGET_ESTIMATE_UNAVAILABLE` là lỗi không retry. Job chuyển thẳng `FAILED`, không gọi provider/fallback, và trả error code/message tiếng Việt an toàn để UI hiển thị.
- Từ `M9.33`, API/worker phát event trạng thái tối thiểu qua Socket.IO để Admin
  lesson detail invalidate/refetch sớm; endpoint này và `background_jobs` vẫn là
  nguồn snapshot authoritative khi reconnect hoặc fallback polling.

Response:

```json
{
  "data": {
    "jobId": "uuid",
    "queue": "AI_GENERATION",
    "status": "SUCCEEDED",
    "resourceType": "QUIZ_SET",
    "resourceId": "uuid",
    "result": {},
    "error": null
  }
}
```

---

## 22.1. Realtime job status event (`M9.33`)

Namespace: `/realtime`. Transport: WebSocket-only, Socket.IO path mặc định
`/socket.io`.

- Handshake gửi access token ở `auth.token`; socket không hợp lệ bị disconnect.
- Mỗi user đã xác thực tự join room `user:{userId}`.
- Admin gửi `lesson.subscribe.v1` với
  `{ "schemaVersion": 1, "lessonId": "uuid" }`; backend kiểm tra role và lesson
  trước khi join `lesson:{lessonId}`. `lesson.unsubscribe.v1` dùng cùng payload.
- Server emit `background_job.status_changed.v1`. Delivery là at-most-once;
  client phải dedupe `eventId` và refetch REST snapshot sau reconnect/subscribe.

Payload event version 1:

```json
{
  "schemaVersion": 1,
  "eventId": "uuid",
  "eventType": "background_job.status_changed",
  "occurredAt": "2026-09-11T12:00:00.000Z",
  "jobId": "uuid",
  "lessonId": "uuid-or-null",
  "ownerUserId": "uuid-or-null",
  "queue": "AI_GENERATION",
  "status": "RUNNING",
  "attempts": 1,
  "resourceType": "LESSON_SUMMARY",
  "resourceId": "uuid-or-null",
  "updatedAt": "2026-09-11T12:00:00.000Z"
}
```

Event schema strict, không trả raw prompt/output/error, provider metadata,
secret, object key hoặc signed URL. Lỗi publish realtime chỉ được log và không
được đổi kết quả/retry của background job.

---
