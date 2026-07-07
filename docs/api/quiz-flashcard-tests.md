# API Quiz Flashcard Tests

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 10. Quiz API

### 10.1. Admin quiz set

#### `GET /admin/lessons/:lessonId/quiz-sets`

Role: `ADMIN`.

#### `POST /admin/lessons/:lessonId/quiz-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Quiz cơ bản",
  "difficulty": "EASY",
  "questions": [
    {
      "questionType": "MULTIPLE_CHOICE",
      "questionJson": {},
      "optionsJson": {},
      "correctAnswerJson": {},
      "hintJson": {},
      "gradingConfigJson": null,
      "difficulty": "EASY"
    }
  ]
}
```

#### `POST /admin/lessons/:lessonId/quiz-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "questionCount": 10,
  "difficulty": "MEDIUM",
  "questionTypes": ["MULTIPLE_CHOICE", "TRUE_FALSE"]
}
```

Response: `202 Accepted` với `jobId`.

Side effects:

- Tạo `background_jobs` queue `AI_GENERATION`.
- Tạo `ai_generations` type `QUIZ`.
- Enqueue AI job.

#### `PATCH /admin/quiz-sets/:quizSetId`

Role: `ADMIN`.

#### `DELETE /admin/quiz-sets/:quizSetId`

Role: `ADMIN`.

#### `POST /admin/quiz-sets/:quizSetId/review`

Role: `ADMIN`.

Body:

```json
{ "reviewStatus": "APPROVED" }
```

### 10.2. Admin quiz question item-level CRUD

#### `POST /admin/quiz-sets/:quizSetId/questions`

Role: `ADMIN`.

Body:

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "questionJson": {},
  "optionsJson": {},
  "correctAnswerJson": {},
  "hintJson": {},
  "gradingConfigJson": {},
  "difficulty": "EASY",
  "sortOrder": 1
}
```

#### `PATCH /admin/quiz-questions/:questionId`

Role: `ADMIN`.

Behavior:

- Cập nhật câu hỏi.
- Nếu nội dung/correct answer/hint thay đổi, mark explanation liên quan stale hoặc xóa `explanation_id` theo AI/RAG spec.
- Ghi audit log.

#### `DELETE /admin/quiz-questions/:questionId`

Role: `ADMIN`.

Behavior: soft delete.

### 10.3. Student quiz

#### `GET /student/lessons/:lessonId/quiz-sets`

Role: `STUDENT`.

Behavior: trả bộ quiz được phép dùng.

#### `POST /student/quiz-sets/:quizSetId/attempts`

Role: `STUDENT`.

Side effect: tạo attempt.

#### `POST /student/quiz-attempts/:attemptId/submit`

Role: `STUDENT`.

Body:

```json
{
  "answers": [
    { "questionId": "uuid", "answerJson": {} }
  ]
}
```

Behavior:

- Chấm bài.
- Lưu answers.
- Trả correct/wrong count.

#### `POST /student/lessons/:lessonId/quiz-sets/request-new`

Role: `STUDENT`.

Behavior:

- Kiểm tra bộ dự phòng phù hợp.
- Nếu còn, trả bộ có sẵn.
- Nếu hết, enqueue AI generate bộ mới.

Response nếu có bộ dự phòng:

```json
{
  "data": {
    "mode": "EXISTING",
    "setId": "uuid"
  }
}
```

Response nếu phải tạo AI job: `202 Accepted`.

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

---

## 11. Flashcard API

### 11.1. Admin flashcard set

#### `GET /admin/lessons/:lessonId/flashcard-sets`

Role: `ADMIN`.

#### `POST /admin/lessons/:lessonId/flashcard-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Flashcard công thức",
  "difficulty": "MEDIUM",
  "cards": [
    {
      "frontJson": {},
      "backJson": {},
      "hintJson": {},
      "difficulty": "MEDIUM"
    }
  ]
}
```

#### `POST /admin/lessons/:lessonId/flashcard-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "cardCount": 20,
  "difficulty": "MEDIUM"
}
```

Response: `202 Accepted` với `jobId`.

#### `PATCH /admin/flashcard-sets/:setId`

Role: `ADMIN`.

#### `DELETE /admin/flashcard-sets/:setId`

Role: `ADMIN`.

#### `POST /admin/flashcard-sets/:setId/review`

Role: `ADMIN`.

### 11.2. Admin flashcard item-level CRUD

#### `POST /admin/flashcard-sets/:setId/cards`

Role: `ADMIN`.

Body:

```json
{
  "frontJson": {},
  "backJson": {},
  "hintJson": {},
  "difficulty": "MEDIUM",
  "sortOrder": 1
}
```

#### `PATCH /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior:

- Cập nhật flashcard.
- Nếu nội dung thay đổi, mark explanation stale.

#### `DELETE /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior: soft delete.

### 11.3. Student flashcard

#### `GET /student/lessons/:lessonId/flashcard-sets`

Role: `STUDENT`.

#### `POST /student/flashcards/:flashcardId/progress`

Role: `STUDENT`.

Body:

```json
{ "isKnown": true }
```

#### `POST /student/lessons/:lessonId/flashcard-sets/request-new`

Role: `STUDENT`.

Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---

## 12. Test API

### 12.1. Admin test set

#### `GET /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

#### `POST /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Bài kiểm tra ngắn",
  "durationSeconds": 900,
  "difficultyRatioJson": { "easy": 0.4, "medium": 0.4, "hard": 0.2 },
  "questions": []
}
```

#### `POST /admin/lessons/:lessonId/test-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "questionCount": 10,
  "durationSeconds": 900,
  "difficultyRatio": { "easy": 0.4, "medium": 0.4, "hard": 0.2 }
}
```

Response: `202 Accepted` với `jobId`.

#### `PATCH /admin/test-sets/:testSetId`

Role: `ADMIN`.

#### `DELETE /admin/test-sets/:testSetId`

Role: `ADMIN`.

#### `POST /admin/test-sets/:testSetId/review`

Role: `ADMIN`.

### 12.2. Admin test question item-level CRUD

#### `POST /admin/test-sets/:testSetId/questions`

Role: `ADMIN`.

Body:

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "questionJson": {},
  "optionsJson": {},
  "correctAnswerJson": {},
  "hintJson": {},
  "gradingConfigJson": {},
  "points": null,
  "difficulty": "MEDIUM",
  "sortOrder": 1
}
```

#### `PATCH /admin/test-questions/:questionId`

Role: `ADMIN`.

Behavior:

- Cập nhật câu hỏi.
- Nếu nội dung/correct answer/hint thay đổi, mark explanation stale.

#### `DELETE /admin/test-questions/:questionId`

Role: `ADMIN`.

Behavior: soft delete.

### 12.3. Student test

#### `GET /student/lessons/:lessonId/test-sets/status`

Role: `STUDENT`.

Response gồm:

```json
{
  "data": {
    "canStart": true,
    "examOpenAt": "2026-08-01T13:00:00.000Z",
    "bestAttempt": {
      "score": 8,
      "durationSeconds": 600
    }
  }
}
```

#### `POST /student/lessons/:lessonId/test-attempts/start`

Role: `STUDENT`.

Behavior:

- Kiểm tra đã đến `exam_open_at`.
- Chọn bộ đề phù hợp.
- Tạo attempt.
- Trả câu hỏi không kèm đáp án đúng.

#### `POST /student/test-attempts/:attemptId/submit`

Role: `STUDENT`.

Body:

```json
{
  "answers": [
    { "questionId": "uuid", "answerJson": {} }
  ]
}
```

Behavior:

- Chấm điểm thang 10.
- Lưu attempt answers.
- Cập nhật best attempt trong transaction.
- Nếu score >= lesson completion score, cập nhật lesson progress completed.
- Tạo XP event idempotent nếu đủ điều kiện.
- Gửi notification cho student/parent nếu cần.

#### `GET /student/test-attempts/:attemptId/review`

Role: `STUDENT`.

Behavior:

- Chỉ sau khi submit.
- Trả câu hỏi, answer của học sinh, correct answer, trạng thái đúng/sai.

#### `POST /student/lessons/:lessonId/test-sets/request-new`

Role: `STUDENT`.

Behavior:

- Chỉ cho request khi test đã mở.
- Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---
