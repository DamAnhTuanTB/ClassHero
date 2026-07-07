# API Student Learning

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 9. Student lesson API

### `GET /student/learning-paths/:id`

Role: `STUDENT`.

Behavior:

- Trả chi tiết lộ trình.
- Kèm enrollment/trial status.

### `GET /student/lessons/:lessonId`

Role: `STUDENT`.

Behavior:

- Kiểm tra enrollment còn hạn hoặc trial hợp lệ.
- Trả video, tài liệu, tóm tắt, quiz/flashcard/test metadata, notes/comments/favorites của student.
- Trước `exam_open_at`, bài kiểm tra có `canStartTest = false`.

### `GET /student/lessons/:lessonId/leaderboard/top-tests`

Role: `STUDENT`.

Behavior:

- Trả top 5 theo best score, tie-break duration.

---

## 14. Notes, comments, favorites API

### `GET /student/lessons/:lessonId/notes`

Role: `STUDENT`.

### `POST /student/lessons/:lessonId/notes`

Role: `STUDENT`.

Body:

```json
{ "contentJson": {} }
```

### `PATCH /student/notes/:noteId`

Role: `STUDENT`.

### `DELETE /student/notes/:noteId`

Role: `STUDENT`.

### `GET /student/lessons/:lessonId/video-comments`

Role: `STUDENT`.

Behavior: trả comment riêng của chính student.

### `POST /student/lessons/:lessonId/video-comments`

Role: `STUDENT`.

### `POST /student/favorites/toggle`

Role: `STUDENT`.

Body:

```json
{
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid",
  "lessonId": "uuid"
}
```

### `GET /student/lessons/:lessonId/favorites`

Role: `STUDENT`.

---
