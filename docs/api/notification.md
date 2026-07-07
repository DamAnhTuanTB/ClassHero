# API Notification

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

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
