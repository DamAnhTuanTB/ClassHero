# Database Notes Gamification Audit

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

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

M15 planned optional extension, chưa có migration ở thời điểm lập milestone:

```txt
playback_seconds numeric?
source_seconds numeric?
video_timeline_version string?
chapter_key string?
chapter_title_snapshot string?
```

M15 rules khi implement:

- Các field video đều optional để note thường của `M7.6` tiếp tục hoạt động.
- `playback_seconds` là timestamp học sinh nhìn thấy sau cắt; `source_seconds` dùng cho mapping/debug, không hiển thị trực tiếp.
- `chapter_title_snapshot` không phải nguồn chapter hiện tại; UI resolve chapter mới theo timestamp/version và chỉ dùng snapshot làm fallback.
- Timestamp note không cấp quyền xem lesson; API vẫn enforce ownership/access.

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
