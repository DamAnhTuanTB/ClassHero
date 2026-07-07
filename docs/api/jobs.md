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
