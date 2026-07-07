# 05. API Contract - Hợp đồng API

Bản v0.2. Base path: `/api/v1`.

API dùng REST. Backend dùng NestJS. API docs dùng Swagger/OpenAPI. Tài liệu này đủ để Codex tạo module, controller, service, DTO, guard, policy và test API cơ bản.

---

## 1. Quy ước chung

### 1.1. Response envelope

Response thành công:

```json
{
  "data": {},
  "meta": {}
}
```

Response lỗi:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": []
  }
}
```

### 1.2. Pagination

Query:

```txt
?page=1&pageSize=20&search=abc&sort=createdAt:desc
```

Response meta:

```json
{
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 1.3. Auth/RBAC

Header:

```txt
Authorization: Bearer <access_token>
```

Roles:

```txt
ADMIN
STUDENT
PARENT
```

Backend phải enforce RBAC và ownership ở service/policy layer, không chỉ ở frontend.

### 1.4. HTTP status

```txt
200 OK
201 Created
202 Accepted - job đã được queue
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error
```

### 1.5. Async job convention

Các API tạo job nền trả `jobId = background_jobs.id`.

Response queued chuẩn:

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

Client có thể poll:

```txt
GET /jobs/:jobId
```

hoặc nhận Socket.IO event nếu user online.

---

## 2. Auth API

### `POST /auth/register/student`

Role: public.

Body:

```json
{
  "email": "student1@example.com",
  "phone": "0900000001",
  "username": "student1",
  "password": "Password123!",
  "fullName": "Nguyễn Văn A",
  "grade": 7,
  "gender": "MALE",
  "dateOfBirth": "2012-01-01"
}
```

Side effects:

- Tạo `users` role `STUDENT`.
- Tạo `student_profiles` và `child_code`.
- Hash password.

Errors: `DUPLICATE_EMAIL`, `DUPLICATE_PHONE`, `DUPLICATE_USERNAME`, `VALIDATION_ERROR`.

### `POST /auth/register/parent`

Role: public.

Body:

```json
{
  "email": "parent1@example.com",
  "phone": "0910000001",
  "password": "Password123!",
  "fullName": "Phụ huynh A"
}
```

Side effects:

- Tạo `users` role `PARENT`.
- Tạo `parent_profiles`.
- Hash password.

### `POST /auth/login`

Role: public.

Body:

```json
{
  "identifier": "student1",
  "password": "Password123!"
}
```

Response:

```json
{
  "data": {
    "accessToken": "jwt",
    "refreshToken": "token",
    "user": {
      "id": "uuid",
      "role": "STUDENT",
      "email": "student1@example.com",
      "username": "student1"
    }
  }
}
```

### `POST /auth/refresh`

Role: authenticated by refresh token.

Body:

```json
{ "refreshToken": "token" }
```

Side effects:

- Validate token hash trong `refresh_tokens`.
- Có thể rotate refresh token.

### `POST /auth/logout`

Role: authenticated.

Body:

```json
{ "refreshToken": "token" }
```

Side effects:

- Revoke refresh token.

### `POST /auth/forgot-password`

Role: public.

Body:

```json
{ "identifier": "student1@example.com" }
```

Side effects:

- Tạo `password_reset_tokens` với `token_hash`, `expires_at`.
- Gửi email qua Resend nếu user có email.
- Không tiết lộ email/identifier có tồn tại hay không.

### `POST /auth/reset-password`

Role: public.

Body:

```json
{
  "token": "reset-token",
  "newPassword": "NewPassword123!"
}
```

Side effects:

- Hash token để tra `password_reset_tokens`.
- Reject nếu token expired/used/revoked.
- Cập nhật `users.password_hash`.
- Set `password_reset_tokens.used_at`.
- Revoke refresh tokens hiện có của user.

---

## 3. Current user/profile API

### `GET /me`

Role: authenticated.

Behavior: trả user và profile theo role. Không trả hash/token/secret.

### `PATCH /me/student-profile`

Role: `STUDENT`.

Body:

```json
{
  "displayName": "An",
  "address": "Hà Nội",
  "avatarFileId": "uuid"
}
```

Không cho đổi:

- ngày sinh,
- họ tên,
- giới tính,
- số điện thoại,
- email.

ASSUMPTION: MVP chưa cần endpoint đổi profile riêng cho parent ngoài avatar nếu sau này chốt.

---

## 4. Public learning path API

### `GET /learning-paths`

Role: public hoặc authenticated.

Query:

```txt
subject=MATH&grade=7&page=1&pageSize=20
```

Behavior:

- Chỉ trả `PUBLISHED`.
- Nếu user là student, ưu tiên lộ trình theo grade.
- Nếu authenticated, kèm enrollment/trial state.

### `GET /learning-paths/:id`

Role: public hoặc authenticated.

Behavior:

- Trả thông tin lộ trình.
- Trả lessons public metadata.
- Trả trạng thái enrollment/trial nếu authenticated.

---

## 5. Admin learning path API

### `GET /admin/learning-paths`

Role: `ADMIN`.

Query: `status`, `subject`, `grade`, `search`, pagination.

### `POST /admin/learning-paths`

Role: `ADMIN`.

Body:

```json
{
  "title": "Toán 7",
  "subject": "MATH",
  "grade": 7,
  "originalPriceVnd": 2000000,
  "salePriceVnd": 1500000,
  "thumbnailFileId": "uuid",
  "descriptionJson": {},
  "trialEnabled": true,
  "status": "DRAFT"
}
```

Side effects:

- Tạo `learning_paths`.
- Ghi `audit_logs`.

### `PATCH /admin/learning-paths/:id`

Role: `ADMIN`.

### `DELETE /admin/learning-paths/:id`

Role: `ADMIN`.

Behavior: soft delete hoặc archive.

### `POST /admin/learning-paths/:id/publish`

Role: `ADMIN`.

Behavior: set status `PUBLISHED`, set `published_at`.

---

## 6. Admin lesson API

### `GET /admin/learning-paths/:learningPathId/lessons`

Role: `ADMIN`.

### `POST /admin/learning-paths/:learningPathId/lessons`

Role: `ADMIN`.

Body:

```json
{
  "orderIndex": 1,
  "title": "Buổi 1: Số hữu tỉ",
  "shortDescription": "Ôn tập số hữu tỉ và phép tính cơ bản",
  "scheduledAt": "2026-08-01T12:00:00.000Z",
  "examOpenAt": "2026-08-01T13:00:00.000Z",
  "videoUrl": "https://youtube.com/...",
  "completionMinScore": 7,
  "status": "DRAFT"
}
```

### `GET /admin/lessons/:lessonId`

Role: `ADMIN`.

### `PATCH /admin/lessons/:lessonId`

Role: `ADMIN`.

### `DELETE /admin/lessons/:lessonId`

Role: `ADMIN`.

### `POST /admin/lessons/:lessonId/publish`

Role: `ADMIN`.

---

## 7. Lesson summary API

### `GET /admin/lessons/:lessonId/summary`

Role: `ADMIN`.

### `PUT /admin/lessons/:lessonId/summary`

Role: `ADMIN`.

Body:

```json
{
  "contentJson": {},
  "source": "ADMIN",
  "reviewStatus": "APPROVED"
}
```

Side effects:

- Upsert `lesson_summaries`.
- Ghi audit log.

### `POST /admin/lessons/:lessonId/summary/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "documentIds": ["uuid"],
  "style": "student_friendly"
}
```

Response: `202 Accepted`.

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

Side effects:

- Tạo `background_jobs` queue `AI_GENERATION`.
- Tạo `ai_generations` type `SUMMARY`.
- Enqueue AI generation job.

### `GET /student/lessons/:lessonId/summary`

Role: `STUDENT`.

Behavior:

- Kiểm tra enrollment hoặc trial.
- Trả summary đã được phép xem.

---

## 8. File/material API

### `POST /files/upload`

Role: authenticated.

Content-Type: `multipart/form-data`.

Fields:

```txt
file: binary
purpose: AVATAR | LESSON_DOCUMENT | EDITOR_IMAGE | QUESTION_IMAGE | NOTE_IMAGE
```

Permission matrix:

```txt
ADMIN:
- LESSON_DOCUMENT
- EDITOR_IMAGE
- QUESTION_IMAGE

STUDENT:
- AVATAR
- NOTE_IMAGE

PARENT:
- TODO: chốt parent avatar trong MVP hay không.

AI_DIAGRAM:
- Không cho client upload trực tiếp.
- Chỉ backend/worker tạo sau khi validate diagram_spec_json.
```

Behavior:

- Validate file type/size theo purpose.
- Upload Cloudflare R2.
- Lưu `files` với `purpose`.
- Trả file metadata.

### `GET /files/:fileId/signed-url`

Role: authenticated.

Behavior:

- Kiểm tra quyền dựa trên purpose, owner và entity tham chiếu.
- Trả signed URL ngắn hạn.

### `POST /admin/lessons/:lessonId/documents`

Role: `ADMIN`.

Body:

```json
{
  "fileId": "uuid",
  "title": "PDF bài học"
}
```

Side effects:

- Tạo `lesson_documents`.
- Tạo `background_jobs` queue `DOCUMENT_PROCESSING`.
- Enqueue job nếu PDF.

### `GET /admin/lessons/:lessonId/documents`

Role: `ADMIN`.

### `POST /admin/lessons/:lessonId/materials`

Role: `ADMIN`.

Body:

```json
{
  "type": "RICH_TEXT",
  "title": "Phiếu chuẩn bị",
  "contentJson": {},
  "fileId": null,
  "url": null
}
```

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
      "diagramSpecJson": null,
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

## 15. Parent API

### `POST /parent/children/link`

Role: `PARENT`.

Body:

```json
{ "childCode": "ABC123" }
```

Behavior:

- Kiểm tra child code.
- Kiểm tra student chưa có parent.
- Tạo link.

### `GET /parent/children`

Role: `PARENT`.

### `GET /parent/children/:studentId/dashboard`

Role: `PARENT`.

Behavior:

- Kiểm tra parent-child link.
- Trả progress, best test, XP/level, notifications liên quan.

### `GET /parent/children/:studentId/learning-paths`

Role: `PARENT`.

Behavior:

- Trả danh sách lộ trình ưu tiên theo grade của con.
- Kèm trạng thái enrollment của con.

### `POST /parent/children/:studentId/payments`

Role: `PARENT`.

Body:

```json
{
  "learningPathId": "uuid",
  "discountCode": "SALE10",
  "idempotencyKey": "client-generated-key"
}
```

Behavior giống payment student nhưng enrollment tạo cho con.

---

## 16. Payment API

### `POST /student/payments`

Role: `STUDENT`.

Body:

```json
{
  "learningPathId": "uuid",
  "discountCode": "SALE10",
  "idempotencyKey": "client-generated-key"
}
```

Behavior:

- Kiểm tra student chưa có active enrollment còn hạn.
- Nếu có payment `PENDING` chưa hết hạn cho cùng student + learning path, có thể trả payment cũ.
- Server tính giá, không tin amount từ client.
- Tạo payOS order.
- Lưu payment `PENDING`.
- Trả checkout/QR.

### `GET /payments/:paymentId`

Role: authenticated.

Behavior:

- Student xem payment của mình.
- Parent xem payment mình tạo.
- Admin xem mọi payment.

### `POST /webhooks/payos`

Role: public webhook, nhưng phải verify checksum.

Behavior:

- Lưu `payment_webhook_logs` ngay khi nhận.
- Verify signature/checksum.
- Idempotency theo `provider_order_code` và event id nếu có.
- Update payment.
- Create enrollment 12 tháng nếu paid.
- Trigger notification.
- Không xử lý paid hai lần.

---

## 17. Discount API

### `GET /admin/discount-codes`

Role: `ADMIN`.

### `POST /admin/discount-codes`

Role: `ADMIN`.

Body:

```json
{
  "code": "SALE10",
  "type": "PERCENT",
  "value": 10,
  "startsAt": "2026-08-01T00:00:00.000Z",
  "endsAt": "2026-09-01T00:00:00.000Z",
  "maxUses": 100,
  "isActive": true
}
```

### `POST /discount-codes/validate`

Role: authenticated.

Body:

```json
{
  "code": "SALE10",
  "learningPathId": "uuid"
}
```

Response: amount preview. Server vẫn phải tính lại khi tạo payment.

---

## 18. Notification API

### `GET /notifications`

Role: authenticated.

Query: `page`, `pageSize`, `unreadOnly`.

### `PATCH /notifications/:id/read`

Role: authenticated.

Behavior: set `read_at` nếu notification thuộc user.

### `PATCH /notifications/read-all`

Role: authenticated.

### `POST /admin/notifications/manual`

Role: `ADMIN`.

Body:

```json
{
  "recipientUserIds": ["uuid"],
  "title": "Thông báo lịch học",
  "body": "Buổi học sẽ bắt đầu sau 15 phút",
  "channels": ["IN_APP"]
}
```

Behavior:

- Tạo `notifications`.
- Gửi Socket.IO realtime nếu user online.
- Enqueue email/Zalo nếu channels có.

---

## 19. Report API

### `POST /student/reports`

Role: `STUDENT`.

Body:

```json
{
  "targetType": "QUIZ_QUESTION",
  "targetId": "uuid",
  "lessonId": "uuid",
  "reason": "Đáp án sai",
  "description": "Em nghĩ đáp án đúng là B"
}
```

Behavior:

- Chỉ report item cấp câu/card.
- Kiểm tra target thuộc lesson student được phép xem.

### `GET /admin/reports`

Role: `ADMIN`.

Query: `status`, `targetType`, pagination.

### `POST /admin/reports/:reportId/actions`

Role: `ADMIN`.

Body:

```json
{
  "action": "MARK_RESOLVED",
  "note": "Đã sửa đáp án"
}
```

Behavior:

- `HIDE`: set target item `review_status = HIDDEN` hoặc soft delete theo DB model.
- `RESTORE`: set target item `review_status = APPROVED` nếu chưa soft delete.
- `MARK_RESOLVED`: set report `RESOLVED`.
- `REJECT`: set report `REJECTED`.
- Ghi `report_actions` và `audit_logs`.

---

## 20. News/Event/Livestream API

### `GET /news-items`

Role: public/authenticated.

Behavior: chỉ trả published.

### `GET /news-items/:slug`

Role: public/authenticated.

### `GET /admin/news-items`

Role: `ADMIN`.

### `POST /admin/news-items`

Role: `ADMIN`.

Body:

```json
{
  "type": "LIVESTREAM",
  "title": "Livestream ôn tập Toán 7",
  "contentJson": {},
  "startsAt": "2026-08-10T12:00:00.000Z",
  "livestreamUrl": "https://youtube.com/...",
  "status": "DRAFT"
}
```

### `PATCH /admin/news-items/:id`

Role: `ADMIN`.

### `DELETE /admin/news-items/:id`

Role: `ADMIN`.

---

## 21. Leaderboard API

### `GET /leaderboard`

Role: authenticated.

Query: `page`, `pageSize`.

Behavior:

- Trả bảng xếp hạng toàn bộ học sinh.
- Sort theo `level desc`, `total_xp desc`.

ASSUMPTION:

- Tie-break ban đầu dùng `student_profiles.updated_at asc` hoặc `display_name asc` nếu chưa có rule khác.

Response:

```json
{
  "data": [
    {
      "rank": 1,
      "studentUserId": "uuid",
      "displayName": "An",
      "avatarFileId": "uuid",
      "level": 5,
      "totalXp": 1200
    }
  ],
  "meta": {}
}
```

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

## 23. Error codes đề xuất

```txt
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INVALID_CREDENTIALS
DUPLICATE_EMAIL
DUPLICATE_PHONE
DUPLICATE_USERNAME
INVALID_RESET_TOKEN
RESET_TOKEN_EXPIRED
INVALID_CHILD_CODE
STUDENT_ALREADY_LINKED_TO_PARENT
ENROLLMENT_REQUIRED
ACTIVE_ENROLLMENT_EXISTS
TRIAL_NOT_AVAILABLE
LESSON_NOT_OPEN
TEST_NOT_OPEN
ATTEMPT_ALREADY_SUBMITTED
PAYMENT_NOT_FOUND
PAYMENT_WEBHOOK_INVALID_SIGNATURE
PAYMENT_ALREADY_PROCESSED
DISCOUNT_INVALID
DISCOUNT_EXPIRED
AI_CONTEXT_NOT_FOUND
AI_OUTPUT_INVALID
AI_JOB_NOT_FOUND
FILE_TYPE_NOT_ALLOWED
FILE_TOO_LARGE
FILE_PURPOSE_NOT_ALLOWED
REPORT_TARGET_INVALID
```

---

## 24. Security rules bắt buộc

- Backend enforce RBAC cho mọi endpoint cần quyền.
- Student không được xem attempt/note/comment/favorite của student khác.
- Parent chỉ được xem con đã link.
- Admin endpoint phải role `ADMIN`.
- Payment webhook verify checksum.
- Payment webhook phải idempotent.
- File signed URL phải kiểm tra quyền trước.
- Không trả correct answer cho test trước khi submit.
- Không trả password hash, refresh token hash, reset token hash, provider secret, raw secret.
- Không lưu secret/API key trong database job result hoặc AI prompt.
