# Database Learning Paths And Lessons

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 5. Learning paths, chapters và lessons

### 5.1. `learning_paths`

```txt
id uuid pk
subject Subject
grade int
title string
slug string unique
original_price_vnd int
sale_price_vnd int?
total_chapter_count int default 0
total_lesson_count int default 0
thumbnail_file_id uuid? fk files.id
description_json jsonb?
status PublishStatus default DRAFT
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

Status behavior:

- `DRAFT` là trạng thái mặc định khi tạo lộ trình.
- `ARCHIVED` chỉ dùng cho xóa mềm; không nằm trong danh sách quản trị mặc định.
- Khôi phục lộ trình archived đưa `status` về `DRAFT` và clear `deleted_at`/`published_at` nếu có.
- Xóa vĩnh viễn chỉ thực hiện từ thùng rác quản trị với item đang archived; cần audit log và tuân thủ chính sách retention khi nối backend thật.

### 5.2. `learning_path_chapters`

Chương học là lớp nhóm tổng quan trong lộ trình. Chương không có video, tài liệu/PDF riêng, summary học tập riêng, quiz, flashcard hoặc test.

```txt
id uuid pk
learning_path_id uuid fk learning_paths.id
order_index int
title string
overview string?
objectives_json jsonb?
status PublishStatus default DRAFT
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Constraint:

- unique `(learning_path_id, order_index)`.

Rules:

- `overview` là mô tả/tổng quan ngắn của chương.
- `objectives_json` lưu các mục tiêu học tập chính hoặc nội dung trọng tâm nếu admin nhập.
- Khi xóa mềm chương, backend phải xử lý các buổi học con theo policy đã chốt ở API/service; không được xóa vĩnh viễn dữ liệu học tập nếu chưa qua flow archive/retention.

### 5.3. `lessons`

```txt
id uuid pk
learning_path_id uuid fk learning_paths.id
chapter_id uuid fk learning_path_chapters.id
order_index int
title string
short_description string?
lesson_type LessonType default BASIC
live_url string?
prep_material_json jsonb?
scheduled_at timestamp?
exam_open_at timestamp?
video_url string?
completion_min_score numeric default 7
trial_enabled boolean default false
status PublishStatus default DRAFT
created_by_id uuid? fk users.id
updated_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Constraint:

- unique `(chapter_id, order_index)`.

Rules:

- Buổi học luôn thuộc một chương học.
- `lesson_type` chỉ nhận `BASIC` hoặc `LIVE` và mặc định là `BASIC`.
- `live_url` là optional cho buổi `LIVE`; buổi `BASIC` luôn lưu `live_url = null`.
- `learning_path_id` trên `lessons` được giữ như denormalized compatibility/filter field trong giai đoạn nối M3.4; source of truth phân cấp vẫn là `chapter_id -> learning_path_chapters.learning_path_id`.
- Quiz, flashcard, test, document, summary, progress và AI chat vẫn gắn với `lesson_id`.
- Counter `learning_paths.total_chapter_count` và `learning_paths.total_lesson_count` phải được service cập nhật khi tạo/xóa mềm phần tử liên quan.

### 5.4. `lesson_materials`

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

### 5.5. `lesson_summaries`

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
