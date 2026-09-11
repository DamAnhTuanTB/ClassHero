# API AI Chat

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 13. AI explanation và chat API

### `POST /student/explanations`

Role: `STUDENT`.

Body:

```json
{
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid"
}
```

Behavior:

- Kiểm tra quyền xem target.
- Với `TEST_QUESTION`, chỉ cho gọi nếu student đã submit attempt chứa câu đó.
- Nếu cached explanation hợp lệ và hash không stale, trả `200 OK`.
- Nếu cache stale hoặc chưa có, tạo `background_jobs` + `ai_generations`, trả `202 Accepted`.
- Client poll `GET /jobs/:jobId` hoặc nhận realtime event khi job xong.

Cached response:

```json
{
  "data": {
    "mode": "CACHED",
    "explanation": {
      "id": "uuid",
      "contentJson": {},
      "imageFileId": null
    }
  }
}
```

Queued response:

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

### `POST /admin/explanations/regenerate`

Role: `ADMIN`.

Body:

```json
{
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid"
}
```

Behavior:

- Tạo `AI_GENERATE_EXPLANATION` job.
- MVP overwrite explanation cũ sau khi job thành công.
- Cập nhật hash mới.
- Ghi audit log.

Response: `202 Accepted` với `jobId`.

### `GET /student/lessons/:lessonId/ai-chat/session`

Role: `STUDENT`.

Behavior: lấy hoặc tạo chat session cho student + lesson.

### `POST /student/lessons/:lessonId/ai-chat/messages`

Role: `STUDENT`.

Body:

```json
{
  "message": "Em chưa hiểu vì sao ...",
  "context": {
    "targetType": "QUIZ_QUESTION",
    "targetId": "uuid",
    "explanationId": "uuid"
  }
}
```

Behavior:

- Input chỉ text.
- Retrieval theo `lesson_id`, provider/model/dimension đúng cấu hình.
- Nếu không có context liên quan, AI từ chối trả lời ngoài phạm vi.
- Lưu user message và assistant message.
- Không gửi toàn bộ lịch sử chat vào AI.

ASSUMPTION: Chat AI có thể xử lý sync trong request ở MVP nếu latency chấp nhận được. Nếu provider latency cao, chuyển sang async job sau.

---

## 13.1. Smart video contextual AI (`M15`, planned)

- `ASK_THIS_MOMENT` và `I_DONT_UNDERSTAND` tái sử dụng `AiProvider`, retrieval, cache/job và rate limit hiện có.
- Client chỉ gửi `lessonId`, `playbackSeconds`, action và optional question; backend tự resolve chapter/transcript context.
- Retrieval tiếp tục filter theo lesson; transcript window không thay thế document RAG.
- Cache key phải gồm timeline/transcript/chapter version để cấu hình cắt hoặc nội dung đã sửa không trả explanation cũ.
- Chapter summary/flashcard video là background job, có source timestamp và review status.
- Whole-video summary admin ở `M9.7` là pipeline riêng: bắt buộc video + saved
  transcript, nhận toàn bộ normalized transcript packet và optional chapter
  timeline từ backend, dùng request draft/hash rồi chạy background job. Flow này
  không dùng window transcript của contextual Q&A và không ghi vào Lesson Summary.
- Không gửi raw watch-event stream vào model để “đánh giá” học sinh. Recommendation service dùng feature aggregate/rule giải thích được; model chỉ hỗ trợ nội dung học tập.
