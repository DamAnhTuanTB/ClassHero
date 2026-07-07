# API Parent

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

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
