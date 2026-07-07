# Database Notification Report News

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

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
