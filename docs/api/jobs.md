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
- Từ `M4.3`, job document được enqueue vào BullMQ thật sau khi API tạo durable row. Worker tách API cập nhật `status`, `attempts`, `startedAt`, `finishedAt`, `error` và `result`; document processing foundation chỉ xác nhận job chạy, còn extract/OCR/chunk thật thuộc `M4.4`.

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
