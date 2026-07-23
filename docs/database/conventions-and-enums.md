# Database Conventions And Enums

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 1. Quy ước chung

### 1.1. Naming

- Table name: snake_case, số nhiều.
- Field name: snake_case trong database.
- Prisma model có thể dùng PascalCase và map sang table bằng `@@map`.
- ID dùng UUID.
- Timestamp chuẩn: `created_at`, `updated_at`; thêm `deleted_at` nếu soft delete.
- Các bảng nội dung do admin chỉnh nên có `created_by_id`, `updated_by_id` nếu cần audit.
- Các thao tác quan trọng phải ghi `audit_logs`.

### 1.2. Soft delete

Nên dùng soft delete cho:

- `learning_paths`, `learning_path_chapters`, `lessons`, `lesson_materials`, `lesson_summaries` nếu cần,
- `quiz_sets`, `quiz_questions`,
- `flashcard_sets`, `flashcards`,
- `test_sets`, `test_questions`,
- `files`, `student_notes`, `lesson_video_comments`, `news_items`.

Không bắt buộc soft delete cho logs, attempt, payment, webhook, notification deliveries, AI logs.

### 1.3. Rich text

Các nội dung giàu định dạng lưu dạng JSONB/Tiptap JSON:

- mô tả lộ trình,
- tóm tắt bài học,
- câu hỏi,
- câu trả lời/lựa chọn,
- gợi ý,
- lời giải,
- phiếu tài liệu,
- ghi chú,
- tin tức/sự kiện.

Field thường đặt tên `content_json`, `question_json`, `options_json`, `answer_json`, `correct_answer_json`, `hint_json`, `description_json`.

### 1.4. Money

- Lưu tiền VNĐ bằng integer.
- Không dùng float cho giá tiền.
- Field dùng suffix `_vnd`, ví dụ `original_price_vnd`, `sale_price_vnd`, `amount_vnd`.

### 1.5. Score/numeric

- Điểm bài thi thang 10 có thể là số thập phân.
- Trong Prisma, dùng `Decimal` cho các field `score`, `points`, `total_score`, `completion_min_score`.
- Không dùng JavaScript float để tính tiền. Với điểm số, nếu cần tránh sai số có thể lưu scale integer ở implementation sau; MVP dùng `Decimal`.

### 1.6. pgvector

Embedding lưu trong bảng `document_chunks`.

Prisma có thể khai báo:

```prisma
embedding Unsupported("vector(1536)")?
```

ASSUMPTION: Dimension embedding OpenAI ban đầu là `1536`. Nếu chọn model embedding khác có dimension khác, phải cập nhật migration và tài liệu này.

Migration raw SQL bắt buộc:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Index vector tạo bằng raw SQL, ví dụ HNSW/IVFFlat tùy Supabase hỗ trợ.

---

## 2. Enums

```txt
UserRole: ADMIN, STUDENT, PARENT
UserStatus: ACTIVE, DISABLED, PENDING
Gender: MALE, FEMALE, OTHER, UNKNOWN
Subject: MATH, PHYSICS, CHEMISTRY
PublishStatus: DRAFT, PUBLISHED, HIDDEN, ARCHIVED
Difficulty: EASY, MEDIUM, HARD, MIXED
QuestionType: MULTIPLE_CHOICE, TRUE_FALSE, TEXT_INPUT
ContentSource: ADMIN, AI
ReviewStatus: DRAFT, NEEDS_REVIEW, APPROVED, HIDDEN
EnrollmentStatus: ACTIVE, EXPIRED, CANCELLED
PaymentProvider: PAYOS
PaymentStatus: PENDING, PAID, FAILED, CANCELLED, EXPIRED
DiscountType: PERCENT, FIXED_AMOUNT
FileProvider: CLOUDFLARE_R2, MINIO_LOCAL
FileVisibility: PRIVATE, PUBLIC
FileStatus: UPLOADED, PROCESSING, READY, FAILED, DELETED
FilePurpose: AVATAR, LESSON_DOCUMENT, EDITOR_IMAGE, QUESTION_IMAGE, NOTE_IMAGE, AI_DIAGRAM
DocumentStatus: UPLOADED, PROCESSING, READY, FAILED
LessonDocumentKind: PRIMARY_FROM_SOURCE, SUPPLEMENT, HOMEWORK
LessonMaterialType: PDF, IMAGE, TEXT, RICH_TEXT, LINK
LessonProgressStatus: NOT_STARTED, IN_PROGRESS, COMPLETED
AttemptStatus: IN_PROGRESS, SUBMITTED, GRADED, CANCELLED
NotificationKind: SYSTEM, MANUAL
NotificationType: LESSON_REMINDER, TEST_OPENED, LESSON_COMPLETED, TEST_RESULT, STUDY_LATE, MANUAL, SYSTEM
NotificationChannel: IN_APP, EMAIL, ZALO
DeliveryStatus: PENDING, SENT, FAILED, SKIPPED
ReportTargetType: QUIZ_QUESTION, FLASHCARD, TEST_QUESTION
ReportStatus: OPEN, RESOLVED, REJECTED
ModerationAction: EDIT, HIDE, RESTORE, MARK_RESOLVED, REJECT
AiProviderName: OPENAI, GEMINI
AiGenerationType: SUMMARY, QUIZ, FLASHCARD, TEST, EXPLANATION, CHAT, EMBEDDING, DOCUMENT_EXTRACT, DIAGRAM_RENDER
AiGenerationStatus: QUEUED, RUNNING, SUCCEEDED, FAILED
AiExplanationTargetType: QUIZ_QUESTION, FLASHCARD, TEST_QUESTION
AiChatMessageRole: USER, ASSISTANT, SYSTEM
FavoriteTargetType: QUIZ_QUESTION, FLASHCARD
XpEventSource: LESSON_COMPLETED, BONUS, ADMIN_ADJUSTMENT
NewsType: NEWS, EVENT, LIVESTREAM
BackgroundJobQueue: DOCUMENT_PROCESSING, EMBEDDING, AI_GENERATION, NOTIFICATION_DELIVERY, EMAIL_DELIVERY, ZALO_DELIVERY, DIAGRAM_RENDERING, PAYMENT_POSTPROCESS
BackgroundJobStatus: QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED
```

---
