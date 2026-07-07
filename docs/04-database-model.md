# 04. Database Model - Mô hình dữ liệu

Bản v0.2. Tài liệu này là cơ sở để Codex tạo Prisma schema, migration, index, constraint và raw SQL cần thiết cho Supabase Postgres + pgvector.

Database production dùng Supabase Postgres + pgvector. ORM dùng Prisma. Query vector/hybrid search có thể dùng raw SQL trong Prisma.

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

- `learning_paths`, `lessons`, `lesson_materials`, `lesson_summaries` nếu cần,
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
FileProvider: CLOUDFLARE_R2
FileVisibility: PRIVATE, PUBLIC
FileStatus: UPLOADED, PROCESSING, READY, FAILED, DELETED
FilePurpose: AVATAR, LESSON_DOCUMENT, EDITOR_IMAGE, QUESTION_IMAGE, NOTE_IMAGE, AI_DIAGRAM
DocumentStatus: UPLOADED, PROCESSING, READY, FAILED
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

## 3. Auth và user

### 3.1. `users`

Mục đích: tài khoản dùng chung cho admin, student, parent.

```txt
id uuid pk
role UserRole
status UserStatus default ACTIVE
email string? unique
phone string? unique
username string? unique
password_hash string
full_name string?
gender Gender default UNKNOWN
date_of_birth date?
avatar_file_id uuid? fk files.id
last_login_at timestamp?
email_verified_at timestamp?
phone_verified_at timestamp?
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Index/constraint:

- unique email nếu not null.
- unique phone nếu not null.
- unique username nếu not null.
- index `(role, status)`.

Không bao giờ trả `password_hash` ra API.

### 3.2. `student_profiles`

```txt
id uuid pk
user_id uuid unique fk users.id
grade int
child_code string unique
address string?
display_name string?
total_xp int default 0
level int default 1
created_at timestamp
updated_at timestamp
```

Rules:

- `child_code` dùng để phụ huynh liên kết con.
- Một student có thể có 0 hoặc 1 parent link.

### 3.3. `parent_profiles`

```txt
id uuid pk
user_id uuid unique fk users.id
created_at timestamp
updated_at timestamp
```

### 3.4. `parent_student_links`

```txt
id uuid pk
parent_user_id uuid fk users.id
student_user_id uuid fk users.id
created_at timestamp
```

Constraint:

- unique `(parent_user_id, student_user_id)`.
- unique `student_user_id` để đảm bảo một học sinh chỉ có một phụ huynh.

### 3.5. `refresh_tokens`

```txt
id uuid pk
user_id uuid fk users.id
token_hash string
expires_at timestamp
revoked_at timestamp?
created_at timestamp
```

Index:

- `user_id`.
- `expires_at`.

Rules:

- Không lưu raw refresh token.
- Revoke token khi logout hoặc rotate refresh token.

### 3.6. `password_reset_tokens`

Dùng cho quên mật khẩu/reset mật khẩu.

```txt
id uuid pk
user_id uuid fk users.id
token_hash string
expires_at timestamp
used_at timestamp?
revoked_at timestamp?
request_ip string?
user_agent string?
created_at timestamp
```

Index/constraint:

- unique `token_hash`.
- index `user_id`.
- index `expires_at`.

Rules:

- Không lưu raw reset token.
- Token phải hết hạn sau thời gian ngắn.
- Sau khi reset password thành công, set `used_at`.
- Token đã used/revoked/expired không được dùng lại.

---

## 4. File và tài liệu

### 4.1. `files`

Metadata file lưu trên Cloudflare R2. Không lưu file binary trong database.

```txt
id uuid pk
provider FileProvider default CLOUDFLARE_R2
purpose FilePurpose
bucket string
object_key string unique
original_name string
mime_type string
size_bytes bigint
visibility FileVisibility default PRIVATE
status FileStatus default UPLOADED
uploaded_by_id uuid? fk users.id
public_url string?
checksum string?
metadata_json jsonb?
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- File permission phải kiểm tra theo `purpose`, `uploaded_by_id` và entity đang tham chiếu file.
- Không được chỉ dựa vào `file_id` để cấp signed URL.
- Client không được upload trực tiếp `AI_DIAGRAM`; chỉ backend/worker tạo sau khi validate `diagram_spec_json`.

### 4.2. `lesson_documents`

Dùng cho PDF/tài liệu nguồn cần extract/chunk/embedding.

```txt
id uuid pk
lesson_id uuid fk lessons.id
file_id uuid fk files.id
title string?
status DocumentStatus default UPLOADED
extracted_text text?
extract_error string?
content_hash string?
chunk_count int default 0
processing_job_id uuid? fk background_jobs.id
processed_at timestamp?
embedding_provider AiProviderName?
embedding_model string?
embedding_dimensions int?
metadata_json jsonb?
created_at timestamp
updated_at timestamp
```

Index:

- `lesson_id`.
- `status`.
- `content_hash`.

Rules:

- `content_hash` dùng để phát hiện tài liệu nguồn thay đổi và invalidate embedding/explanation liên quan.
- Nếu tài liệu thay đổi, worker phải tạo lại chunks/embedding và các explanation liên quan có thể bị stale.

### 4.3. `document_chunks`

```txt
id uuid pk
document_id uuid fk lesson_documents.id
lesson_id uuid fk lessons.id
chunk_index int
content text
content_hash string?
token_count int?
embedding Unsupported("vector(1536)")?
embedding_provider AiProviderName?
embedding_model string?
embedding_dimensions int?
metadata_json jsonb?
created_at timestamp
```

Index/constraint:

- unique `(document_id, chunk_index)`.
- index `lesson_id`.
- index `(lesson_id, embedding_provider, embedding_model, embedding_dimensions)`.
- vector index trên `embedding` bằng raw SQL.
- keyword/full-text/trigram index có thể thêm raw SQL nếu cần hybrid search.

Rules:

- Lưu `lesson_id` trực tiếp để retrieval luôn filter theo lesson.
- Retrieval phải filter theo `lesson_id`, `embedding_provider`, `embedding_model`, `embedding_dimensions`.
- Không fallback sang vector space khác nếu provider/model/dimension không khớp.

---

## 5. Learning paths và lessons

### 5.1. `learning_paths`

```txt
id uuid pk
subject Subject
grade int
title string
slug string unique
original_price_vnd int
sale_price_vnd int?
total_lesson_count int default 0
thumbnail_file_id uuid? fk files.id
description_json jsonb?
status PublishStatus default DRAFT
trial_enabled boolean default true
published_at timestamp?
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Index:

- `(subject, grade)`.
- `status`.
- `sort_order`.

### 5.2. `lessons`

```txt
id uuid pk
learning_path_id uuid fk learning_paths.id
order_index int
title string
short_description string?
prep_material_json jsonb?
scheduled_at timestamp?
exam_open_at timestamp?
video_url string?
completion_min_score numeric default 7
status PublishStatus default DRAFT
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Constraint:

- unique `(learning_path_id, order_index)`.

### 5.3. `lesson_materials`

Dùng cho phiếu tài liệu, ảnh, text nhập tay, link phụ.

```txt
id uuid pk
lesson_id uuid fk lessons.id
type LessonMaterialType
file_id uuid? fk files.id
url string?
title string?
content_json jsonb?
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 5.4. `lesson_summaries`

```txt
id uuid pk
lesson_id uuid unique fk lessons.id
content_json jsonb
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
ai_generation_id uuid? fk ai_generations.id
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

---

## 6. Enrollment, progress và học thử

### 6.1. `enrollments`

```txt
id uuid pk
student_user_id uuid fk users.id
learning_path_id uuid fk learning_paths.id
paid_by_user_id uuid? fk users.id
payment_id uuid? fk payments.id
status EnrollmentStatus default ACTIVE
starts_at timestamp
expires_at timestamp
created_at timestamp
updated_at timestamp
```

Index/constraint:

- index `(student_user_id, learning_path_id, status)`.
- Raw SQL partial unique index cho một active enrollment.

Raw SQL:

```sql
CREATE UNIQUE INDEX enrollments_one_active_per_student_path
ON enrollments(student_user_id, learning_path_id)
WHERE status = 'ACTIVE';
```

Rules:

- Sau thanh toán thành công, `expires_at = paid_at + interval '12 months'`.
- Nếu đã có enrollment active còn hạn, không tạo payment/enrollment mới cho cùng student + learning path.
- Service hoặc scheduled job phải chuyển enrollment hết hạn sang `EXPIRED` khi cần.

### 6.2. `lesson_progress`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
status LessonProgressStatus default NOT_STARTED
best_test_attempt_id uuid? fk test_attempts.id
best_score numeric?
best_duration_seconds int?
completed_at timestamp?
xp_awarded boolean default false
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(student_user_id, lesson_id)`.

Rules:

- Buổi học completed khi bài kiểm tra đạt `completion_min_score`, mặc định 7.
- `best_test_attempt_id` là nguồn chính cho kết quả tốt nhất.
- Nếu dùng thêm `test_attempts.is_best_for_lesson`, phải cập nhật trong transaction.

### 6.3. Trial access

ASSUMPTION: Không cần bảng trial riêng ở MVP. Quyền học thử được tính bằng:

- `learning_paths.trial_enabled = true`.
- `lessons.order_index = 1`.
- Student chưa có enrollment active.

Nếu cần tracking trial view, thêm bảng `trial_access_logs` sau.

---

## 7. Quiz

### 7.1. `quiz_sets`

```txt
id uuid pk
lesson_id uuid fk lessons.id
title string
difficulty Difficulty default MIXED
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
is_reserve boolean default false
generated_by_user_id uuid? fk users.id
ai_generation_id uuid? fk ai_generations.id
question_count int default 0
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- Bộ AI tạo do học sinh yêu cầu có `source = AI`, `review_status = NEEDS_REVIEW`, `is_reserve = true`.
- Dù chưa duyệt, học sinh vẫn được dùng nếu service chọn bộ đó.

### 7.2. `quiz_questions`

```txt
id uuid pk
quiz_set_id uuid fk quiz_sets.id
lesson_id uuid fk lessons.id
question_type QuestionType
question_json jsonb
options_json jsonb?
correct_answer_json jsonb
hint_json jsonb?
grading_config_json jsonb?
difficulty Difficulty default MEDIUM
review_status ReviewStatus default APPROVED
explanation_id uuid? fk ai_explanations.id
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Index:

- `quiz_set_id`.
- `lesson_id`.
- `(lesson_id, review_status)`.

Rules:

- Với `TEXT_INPUT`, `grading_config_json` có thể chứa `acceptedAnswers`, `caseSensitive`, `trimWhitespace`, `numericTolerance`, `unitRequired`, `acceptedUnits`.
- Khi admin sửa nội dung/correct answer/hint, service phải mark explanation stale hoặc xóa `explanation_id` theo AI/RAG spec.

### 7.3. `quiz_attempts`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
quiz_set_id uuid fk quiz_sets.id
status AttemptStatus default IN_PROGRESS
started_at timestamp
submitted_at timestamp?
correct_count int default 0
wrong_count int default 0
total_count int default 0
created_at timestamp
updated_at timestamp
```

### 7.4. `quiz_attempt_answers`

```txt
id uuid pk
attempt_id uuid fk quiz_attempts.id
question_id uuid fk quiz_questions.id
answer_json jsonb
is_correct boolean
created_at timestamp
```

Constraint:

- unique `(attempt_id, question_id)`.

---

## 8. Flashcard

### 8.1. `flashcard_sets`

```txt
id uuid pk
lesson_id uuid fk lessons.id
title string
difficulty Difficulty default MIXED
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
is_reserve boolean default false
generated_by_user_id uuid? fk users.id
ai_generation_id uuid? fk ai_generations.id
card_count int default 0
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 8.2. `flashcards`

```txt
id uuid pk
flashcard_set_id uuid fk flashcard_sets.id
lesson_id uuid fk lessons.id
front_json jsonb
back_json jsonb
hint_json jsonb?
explanation_id uuid? fk ai_explanations.id
difficulty Difficulty default MEDIUM
review_status ReviewStatus default APPROVED
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- Khi admin sửa `front_json`, `back_json` hoặc `hint_json`, service phải mark explanation stale hoặc xóa `explanation_id`.

### 8.3. `flashcard_progress`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
flashcard_id uuid fk flashcards.id
is_known boolean
last_reviewed_at timestamp
review_count int default 0
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(student_user_id, flashcard_id)`.

---

## 9. Bài kiểm tra

### 9.1. `test_sets`

```txt
id uuid pk
lesson_id uuid fk lessons.id
title string
duration_seconds int
difficulty Difficulty default MIXED
difficulty_ratio_json jsonb?
source ContentSource default ADMIN
review_status ReviewStatus default APPROVED
is_reserve boolean default false
generated_by_user_id uuid? fk users.id
ai_generation_id uuid? fk ai_generations.id
question_count int default 0
total_score numeric default 10
sort_order int default 0
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 9.2. `test_questions`

```txt
id uuid pk
test_set_id uuid fk test_sets.id
lesson_id uuid fk lessons.id
question_type QuestionType
question_json jsonb
options_json jsonb?
correct_answer_json jsonb
hint_json jsonb?
grading_config_json jsonb?
points numeric?
difficulty Difficulty default MEDIUM
review_status ReviewStatus default APPROVED
explanation_id uuid? fk ai_explanations.id
sort_order int default 0
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Rules:

- Nếu `points` null, service tính điểm bằng nhau để tổng là 10.
- Với `TEXT_INPUT`, dùng `grading_config_json` như quiz.
- Khi admin sửa nội dung/correct answer/hint, service phải mark explanation stale hoặc xóa `explanation_id`.

### 9.3. `test_attempts`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
test_set_id uuid fk test_sets.id
status AttemptStatus default IN_PROGRESS
started_at timestamp
submitted_at timestamp?
duration_seconds int?
score numeric?
correct_count int default 0
wrong_count int default 0
total_count int default 0
is_best_for_lesson boolean default false
created_at timestamp
updated_at timestamp
```

Index:

- `(student_user_id, lesson_id)`.
- `(lesson_id, score, duration_seconds)` cho top 5 lesson.

Raw SQL:

```sql
CREATE UNIQUE INDEX test_attempts_one_best_per_student_lesson
ON test_attempts(student_user_id, lesson_id)
WHERE is_best_for_lesson = true;
```

Rules:

- Cập nhật best attempt phải chạy trong transaction.
- Best result ưu tiên điểm cao hơn; nếu bằng điểm, thời gian làm nhanh hơn.
- `lesson_progress.best_test_attempt_id` là nguồn chính; `is_best_for_lesson` là denormalized để query nhanh.

### 9.4. `test_attempt_answers`

```txt
id uuid pk
attempt_id uuid fk test_attempts.id
question_id uuid fk test_questions.id
answer_json jsonb
is_correct boolean
points_awarded numeric?
created_at timestamp
```

Constraint:

- unique `(attempt_id, question_id)`.

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

---

## 11. AI, RAG và chat

### 11.1. `ai_generations`

Log mọi AI job/generation quan trọng.

```txt
id uuid pk
type AiGenerationType
status AiGenerationStatus default QUEUED
provider AiProviderName?
model string?
created_by_user_id uuid? fk users.id
lesson_id uuid? fk lessons.id
background_job_id uuid? fk background_jobs.id
target_type string?
target_id uuid?
prompt_version string?
schema_version string?
input_hash string?
output_hash string?
input_meta_json jsonb?
output_json jsonb?
error_message text?
provider_request_id string?
prompt_tokens int?
completion_tokens int?
total_tokens int?
estimated_cost_vnd int?
latency_ms int?
retry_count int default 0
started_at timestamp?
finished_at timestamp?
created_at timestamp
updated_at timestamp
```

Index:

- `(lesson_id, type, status)`.
- `background_job_id`.
- `(target_type, target_id)`.

### 11.2. `ai_explanations`

Cache lời giải AI ở cấp item.

```txt
id uuid pk
target_type AiExplanationTargetType
target_id uuid
lesson_id uuid fk lessons.id
content_json jsonb
diagram_spec_json jsonb?
image_file_id uuid? fk files.id
source ContentSource default AI
review_status ReviewStatus default APPROVED
ai_generation_id uuid? fk ai_generations.id
target_content_hash string?
source_context_hash string?
stale_at timestamp?
regenerated_from_id uuid? fk ai_explanations.id
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(target_type, target_id)`.

Rules:

- Service phải tính hash từ nội dung target và tài liệu/context nguồn.
- Nếu `target_content_hash` hoặc `source_context_hash` không khớp, cache bị coi là stale.
- Admin regenerate ở MVP mặc định overwrite explanation cũ, nhưng phải cập nhật hash và audit log.

### 11.3. `ai_chat_sessions`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
title string?
summary_text text?
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(student_user_id, lesson_id)` cho MVP.

ASSUMPTION: MVP dùng một chat session cho mỗi student + lesson để đơn giản.

### 11.4. `ai_chat_messages`

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
role AiChatMessageRole
content_json jsonb
retrieved_chunk_ids uuid[]?
ai_generation_id uuid? fk ai_generations.id
created_at timestamp
```

### 11.5. `conversation_summaries`

```txt
id uuid pk
session_id uuid fk ai_chat_sessions.id
summary_text text
message_count int
ai_generation_id uuid? fk ai_generations.id
created_at timestamp
updated_at timestamp
```

---

## 12. Payment và discount

### 12.1. `discount_codes`

```txt
id uuid pk
code string unique
type DiscountType
value int
starts_at timestamp?
ends_at timestamp?
max_uses int?
used_count int default 0
is_active boolean default true
created_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
```

Rules:

- `PERCENT`: value từ 1 đến 100.
- `FIXED_AMOUNT`: value là số VNĐ.
- Service phải validate thời hạn, số lượt dùng, active status.
- Server luôn tính lại giá khi tạo payment, không tin amount từ client.

### 12.2. `payments`

```txt
id uuid pk
provider PaymentProvider default PAYOS
status PaymentStatus default PENDING
payer_user_id uuid fk users.id
student_user_id uuid fk users.id
learning_path_id uuid fk learning_paths.id
discount_code_id uuid? fk discount_codes.id
idempotency_key string?
provider_order_code string unique
provider_payment_link_id string?
checkout_url string?
qr_code string?
amount_vnd int
original_amount_vnd int
discount_amount_vnd int default 0
paid_at timestamp?
expired_at timestamp?
raw_response_json jsonb?
created_at timestamp
updated_at timestamp
```

Index/constraint:

- unique `provider_order_code`.
- index `(payer_user_id, status)`.
- index `(student_user_id, learning_path_id, status)`.
- index `idempotency_key` nếu not null.

Rules:

- Webhook phải idempotent theo `provider_order_code` và/hoặc event id.
- Nếu client gửi `idempotency_key`, service không tạo trùng payment cho cùng payer + student + learning path + key.
- Nếu đã có payment `PENDING` chưa hết hạn cho cùng student + learning path, service có thể trả lại payment cũ.
- Nếu student đã có enrollment active còn hạn, không tạo payment mới.

### 12.3. `payment_webhook_logs`

```txt
id uuid pk
provider PaymentProvider default PAYOS
event_id string?
provider_order_code string?
raw_payload_json jsonb
signature string?
verified boolean default false
processed boolean default false
processing_error text?
received_at timestamp
processed_at timestamp?
```

Index/constraint:

- unique `event_id` nếu payOS cung cấp id unique.
- index `provider_order_code`.
- index `(verified, processed)`.

---

## 13. Notification

### 13.1. `notifications`

```txt
id uuid pk
recipient_user_id uuid fk users.id
actor_user_id uuid? fk users.id
kind NotificationKind
type NotificationType
title string
body text
data_json jsonb?
read_at timestamp?
created_at timestamp
```

Index:

- `(recipient_user_id, created_at desc)`.
- `(recipient_user_id, read_at)`.

### 13.2. `notification_deliveries`

```txt
id uuid pk
notification_id uuid fk notifications.id
channel NotificationChannel
status DeliveryStatus default PENDING
provider_message_id string?
error_message text?
sent_at timestamp?
created_at timestamp
updated_at timestamp
```

Constraint:

- unique `(notification_id, channel)`.

---

## 14. Report và moderation

### 14.1. `reports`

```txt
id uuid pk
reporter_user_id uuid fk users.id
target_type ReportTargetType
target_id uuid
lesson_id uuid fk lessons.id
reason string
description text?
status ReportStatus default OPEN
created_at timestamp
updated_at timestamp
```

Index:

- `(target_type, target_id)`.
- `status`.
- `lesson_id`.

### 14.2. `report_actions`

```txt
id uuid pk
report_id uuid fk reports.id
admin_user_id uuid fk users.id
action ModerationAction
note text?
created_at timestamp
```

Rules:

- `HIDE` với target item set `review_status = HIDDEN` hoặc soft delete tùy service quyết định; MVP ưu tiên `review_status = HIDDEN`.
- `RESTORE` set `review_status = APPROVED` nếu target chưa bị soft delete.
- `MARK_RESOLVED` chỉ cập nhật `reports.status = RESOLVED` và ghi action.
- `REJECT` cập nhật `reports.status = REJECTED`.

---

## 15. Ghi chú, comment riêng, favorite

### 15.1. `student_notes`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
content_json jsonb
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 15.2. `lesson_video_comments`

Comment/ý kiến riêng dưới video, chỉ student đó thấy.

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
content_json jsonb
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

### 15.3. `favorites`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid fk lessons.id
target_type FavoriteTargetType
target_id uuid
created_at timestamp
```

Constraint:

- unique `(student_user_id, target_type, target_id)`.

---

## 16. Gamification và leaderboard

### 16.1. `xp_events`

```txt
id uuid pk
student_user_id uuid fk users.id
lesson_id uuid? fk lessons.id
source XpEventSource
source_ref_id uuid?
idempotency_key string?
xp int
metadata_json jsonb?
created_at timestamp
```

Index/constraint:

- unique `idempotency_key` nếu not null.
- index `(student_user_id, created_at)`.

Rules:

- Với `LESSON_COMPLETED`, service phải đảm bảo chỉ cộng XP một lần cho cùng student + lesson.
- `student_profiles.total_xp` và `student_profiles.level` là denormalized fields, cập nhật trong transaction khi ghi `xp_events`.

### 16.2. Level

ASSUMPTION: Không cần bảng level riêng ở MVP nếu công thức level đơn giản. Có thể lưu `total_xp` và `level` trong `student_profiles`.

TODO: Nếu cần cấu hình level linh hoạt, thêm bảng `level_rules`.

---

## 17. News, events, livestream

### 17.1. `news_items`

```txt
id uuid pk
type NewsType
title string
slug string unique
content_json jsonb
cover_file_id uuid? fk files.id
starts_at timestamp?
ends_at timestamp?
livestream_url string?
status PublishStatus default DRAFT
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
published_at timestamp?
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

---

## 18. Audit log

### 18.1. `audit_logs`

```txt
id uuid pk
actor_user_id uuid? fk users.id
action string
entity_type string
entity_id uuid?
before_json jsonb?
after_json jsonb?
metadata_json jsonb?
ip_address string?
user_agent string?
created_at timestamp
```

Audit log cần cho:

- Admin CRUD nội dung.
- Payment/webhook.
- Enrollment.
- AI generation.
- Report moderation.
- Notification thủ công.
- File upload/xóa.

---

## 19. Raw SQL indexes bắt buộc/khuyến nghị

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE UNIQUE INDEX enrollments_one_active_per_student_path
ON enrollments(student_user_id, learning_path_id)
WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX test_attempts_one_best_per_student_lesson
ON test_attempts(student_user_id, lesson_id)
WHERE is_best_for_lesson = true;
```

Vector index ví dụ, cần điều chỉnh theo Supabase/model thực tế:

```sql
-- Example only. Chỉ tạo sau khi xác định operator class phù hợp.
-- CREATE INDEX document_chunks_embedding_hnsw
-- ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 20. Checklist cho Prisma schema

```txt
[ ] Có đầy đủ enum ở mục 2.
[ ] Có `password_reset_tokens`.
[ ] Có `background_jobs` và `ai_generations.background_job_id`.
[ ] `files` có `purpose`.
[ ] `lesson_documents` có `title`, `content_hash`, `processing_job_id`, provider/model/dimension.
[ ] `document_chunks` có provider/model/dimension và filter rule.
[ ] `quiz_questions`, `flashcards`, `test_questions` có `review_status` để admin ẩn item report.
[ ] `quiz_questions`, `test_questions` có `grading_config_json`.
[ ] `ai_explanations` có hash/stale fields.
[ ] `payments` có `idempotency_key`.
[ ] `xp_events` có idempotency.
[ ] Raw SQL partial unique indexes được tạo trong migration.
```
