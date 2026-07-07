# API Report News

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

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
