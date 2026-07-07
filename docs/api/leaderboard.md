# API Leaderboard

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

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
