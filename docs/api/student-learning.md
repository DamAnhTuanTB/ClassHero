# API Student Learning

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 9. Student lesson API

### `GET /student/learning-paths/:id`

Role: `STUDENT`.

Behavior:

- Trả chi tiết lộ trình.
- Response gồm cây `chapters -> lessons`; chapter chỉ có metadata tổng quan, lesson có trạng thái truy cập/progress.
- Kèm enrollment/trial status.
- `:id` tiếp tục là ID/slug của khóa `CATALOG` đã mua; backend resolve lộ trình hiệu lực từ enrollment.
- Response bổ sung `purchasedLearningPathId`, `deliveryLearningPathId`, `isPersonalized` và `sourceLearningPathId`.
- Cây `chapters -> lessons`, tổng lesson, progress percent và continue lesson lấy từ lộ trình hiệu lực.
- Không trả private slug hoặc cho phép student khác dùng ID bản cá nhân để discovery.

### `GET /student/lessons/:lessonId`

Role: `STUDENT`.

Behavior:

- Kiểm tra enrollment còn hạn hoặc trial hợp lệ.
- Trả metadata chapter cha để UI hiển thị breadcrumb/tổng quan.
- Trả video, tài liệu, tóm tắt, quiz/flashcard/test metadata, notes/comments/favorites của student.
- Trước `exam_open_at`, bài kiểm tra có `canStartTest = false`.
- Nếu lesson thuộc path `PERSONALIZED`, chỉ student sở hữu enrollment đang được giao path đó mới được truy cập.
- Access resolver phải kiểm tra lesson nằm trong lộ trình hiệu lực, không chỉ kiểm tra student đã mua khóa nguồn.
- Lịch sử từ lesson gốc được resolve qua `sourceLessonId` theo contract progress; không sao chép record của student khác.
- Sau activation, mọi write mới của progress/attempt/note/comment/favorite phải dùng lesson/content thuộc bản cá nhân; API không hỗ trợ chuyển enrollment trở lại khóa gốc.

### Error codes bổ sung

```txt
PERSONAL_LEARNING_PATH_EXISTS
PERSONAL_LEARNING_PATH_NOT_READY
PERSONAL_LEARNING_PATH_ACCESS_DENIED
PERSONAL_LEARNING_PATH_CLONE_FAILED
```

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
