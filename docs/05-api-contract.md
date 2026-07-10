# 05. API Contract - Index hợp đồng API

Bản v0.3. File này là index ngắn cho API docs.

Base path: `/api/v1`.

API dùng REST. Backend dùng NestJS. API docs dùng Swagger/OpenAPI. Chi tiết endpoint, request, response, role, error và side effect nằm trong `docs/api/`.

---

## 1. Cách Codex dùng file này

Khi task có API/backend hoặc kết nối UI với API:

1. Đọc file index này.
2. Luôn đọc `docs/api/conventions-errors-security.md` khi thêm/sửa endpoint.
3. Mở file API chi tiết phù hợp trong `docs/api/`.
4. Đọc `docs/04-database-model.md` nếu endpoint dùng data mới, đổi schema hoặc behavior phụ thuộc database.
5. Đọc `docs/06-ai-rag-spec.md` nếu endpoint liên quan AI/RAG.
6. Nếu đổi request/response/side effect, cập nhật file API chi tiết; changelog chỉ ghi trong workflow `/commit`.

Nếu chỉ làm `/task-ui` mock data, dùng API docs để hiểu data shape, không tự connect API.

---

## 2. Quy ước API bắt buộc

- Response thành công dùng envelope `{ "data": ..., "meta": ... }`.
- Response lỗi dùng envelope `{ "error": { "code", "message", "details" } }`.
- Auth dùng `Authorization: Bearer <access_token>`.
- Backend phải enforce RBAC/ownership ở guard/service/policy layer, không chỉ frontend.
- Endpoint admin dùng prefix `/admin`.
- Endpoint parent dùng prefix `/parent` khi cần rõ role.
- Endpoint student dùng prefix `/student` khi cần rõ role.
- API tạo background job trả `jobId = background_jobs.id` và dùng `202 Accepted` khi phù hợp.
- Không tin dữ liệu nhạy cảm từ client như amount, role, ownership, course price.

---

## 3. Mapping file chi tiết

| Khi làm về | Đọc file |
| --- | --- |
| Envelope, pagination, status, error code, security rule | `docs/api/conventions-errors-security.md` |
| Register, login, refresh, logout, forgot/reset, current user/profile | `docs/api/auth-profile.md` |
| Public/admin learning path, chapter, lesson, summary, file/material | `docs/api/learning-paths-lessons.md` |
| Student lesson content, notes, comments, favorites | `docs/api/student-learning.md` |
| Quiz, flashcard, test, attempts | `docs/api/quiz-flashcard-tests.md` |
| AI explanation, chat, generated content | `docs/api/ai-chat.md` |
| Parent dashboard, child link, parent course/payment view | `docs/api/parent.md` |
| Payment, payOS webhook, discount | `docs/api/payment-discount.md` |
| Notification API | `docs/api/notification.md` |
| Report, moderation, news/event/livestream | `docs/api/report-news.md` |
| Leaderboard | `docs/api/leaderboard.md` |
| Job status/polling | `docs/api/jobs.md` |

---

## 4. Milestone routing nhanh

| Milestone | API docs thường cần |
| --- | --- |
| `M2.x` | `auth-profile`, `conventions-errors-security` |
| `M3.x` | `learning-paths-lessons`, `conventions-errors-security` |
| `M4.x` | `learning-paths-lessons`, `jobs`, `conventions-errors-security` |
| `M5.x` | `ai-chat`, `jobs`, `conventions-errors-security` |
| `M6.x` | `quiz-flashcard-tests`, `conventions-errors-security` |
| `M7.x` | `student-learning`, `quiz-flashcard-tests`, `conventions-errors-security` |
| `M8.x` | `payment-discount`, `conventions-errors-security` |
| `M9.x` | `ai-chat`, `jobs`, `conventions-errors-security` |
| `M10.x` | `notification`, `jobs`, `conventions-errors-security` |
| `M11.x` | `parent`, `payment-discount`, `conventions-errors-security` |
| `M12.x` | `report-news`, `conventions-errors-security` |
| `M13.x` | `leaderboard`, `auth-profile`, `conventions-errors-security` |
| `M14.x` | File API liên quan đến flow được test/harden/deploy |

---

## 5. Khi sửa docs API

- Nếu thêm/sửa endpoint: cập nhật file chi tiết trong `docs/api/`.
- Nếu response/request đổi do schema đổi: cập nhật `docs/04-database-model.md` hoặc file con trong `docs/database/`.
- Nếu endpoint đổi flow người dùng: đối chiếu `docs/02-user-flows.md`.
- Nếu endpoint đổi AI/RAG behavior: cập nhật `docs/06-ai-rag-spec.md`.
- Nếu endpoint cần env/provider mới: cập nhật `docs/07-integration-and-env.md`.
