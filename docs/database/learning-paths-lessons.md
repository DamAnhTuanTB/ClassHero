# Database Learning Paths And Lessons

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

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
