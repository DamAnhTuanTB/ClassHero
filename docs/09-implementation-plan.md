# 09. Implementation Plan - Index triển khai

File này là bản index nhẹ để Codex chọn đúng subtask, thứ tự và phụ thuộc.

Chi tiết phạm vi, `Không làm` và `Done khi` từng subtask nằm trong từng file milestone:

```txt
docs/implementation/M0.md
docs/implementation/M1.md
...
docs/implementation/M14.md
```

Nếu cần xem cách map nhanh, mở `docs/implementation/README.md`.

Khi làm task, Codex đọc file index này trước. Sau khi xác định mã subtask, mở đúng file milestone tương ứng. Ví dụ `M8.3` thì đọc `docs/implementation/M8.md`.

---

## 1. Nguyên tắc triển khai

- Không làm tính năng ngoài MVP.
- Không đổi stack công nghệ đã chốt.
- Mỗi lần owner giao task mặc định chỉ làm một subtask.
- Nếu task ngắn chưa ghi rõ subtask, Codex map vào subtask gần nhất rồi nêu giả định.
- Nếu task có thể thuộc nhiều subtask, hỏi lại hoặc ghi `ASSUMPTION` trước khi code.
- Nếu một subtask quá lớn, đề xuất chia nhỏ hơn trước khi code.
- Database/API/AI/env/UI behavior đổi phải cập nhật docs liên quan theo `AGENTS.md`.
- Changelog phải cập nhật khi có thay đổi file đáng commit.

---

## 2. Cách dùng với Codex

### Khi owner giao task rõ mã

Ví dụ:

```txt
/task-full M8.3
```

Codex phải:

1. Đọc `AGENTS.md`.
2. Đọc file index này.
3. Đọc subtask tương ứng trong file milestone, ví dụ `M8.3` đọc `docs/implementation/M8.md`.
4. Đọc docs liên quan theo `Task routing map` trong `AGENTS.md`.
5. Nêu kế hoạch ngắn.
6. Code đúng phạm vi subtask.
7. Chạy check phù hợp và cập nhật changelog.

### Khi owner giao task ngắn

Codex không code ngay nếu phạm vi chưa rõ. Cần:

1. Tự map vào milestone/subtask gần nhất.
2. Nêu subtask đề xuất và mode phù hợp: `/task-ui`, `/task-connect`, hoặc `/task-full`.
3. Chỉ code khi phạm vi đủ rõ.

---

## 3. Thứ tự subtask khuyến nghị

Thứ tự này ưu tiên nền tảng trước tính năng sau. Nếu `.codex/plans/codex-execution-plan.md` có cập nhật mới hơn, dùng file đó để kiểm tra phụ thuộc, nhưng vẫn không thay thế docs gốc.

| Thứ tự | Mã | Tên |
| --- | --- | --- |
| 1 | `M0.P` | Đọc tài liệu và tạo execution plan |
| 2 | `M0.1` | Khởi tạo monorepo Turborepo |
| 3 | `M0.2` | Tooling, env example, Docker local và health check |
| 4 | `M1.1` | Setup Prisma và database foundation |
| 5 | `M1.2` | User, auth token, profile, file và background job models |
| 6 | `M1.3` | Learning path, lesson, material, document và enrollment models |
| 7 | `M1.4` | Quiz, flashcard, test, attempt và learning interaction models |
| 8 | `M1.5` | Payment, notification, report, AI log, gamification và news models |
| 9 | `M1.6` | Seed tối thiểu và database validation |
| 10 | `M2.1` | Backend foundation module |
| 11 | `M2.2` | Register, login, refresh và logout |
| 12 | `M2.3` | RBAC, `GET /me`, profile base và forgot/reset password |
| 13 | `M3.1` | Admin learning path API |
| 14 | `M3.2` | Admin lesson API |
| 15 | `M3.3` | Public/student learning path listing |
| 16 | `M3.4` | Admin learning path/lesson UI cơ bản |
| 17 | `M4.1` | FilesModule và R2 service |
| 18 | `M4.2` | Lesson document API |
| 19 | `M4.3` | BullMQ worker foundation |
| 20 | `M4.4` | PDF extract và chunking |
| 21 | `M6.1` | Rich text JSON và shared content schema |
| 22 | `M6.2` | Quiz CRUD API và admin UI tối thiểu |
| 23 | `M6.3` | Flashcard CRUD API và admin UI tối thiểu |
| 24 | `M6.4` | Test CRUD API và admin UI tối thiểu |
| 25 | `M6.5` | Student read-only lesson content API |
| 26 | `M7.1` | Access check, trial lesson và lesson page skeleton |
| 27 | `M7.2` | Quiz attempt và submit |
| 28 | `M7.3` | Flashcard progress, favorite và review |
| 29 | `M7.4` | Test start, submit và review |
| 30 | `M7.5` | Best attempt, lesson completion và top 5 |
| 31 | `M7.6` | Personal notes và private comments dưới video |
| 32 | `M8.1` | Discount code admin và validation |
| 33 | `M8.2` | Create payment order bằng payOS |
| 34 | `M8.3` | payOS webhook verify, idempotency và enrollment 12 tháng |
| 35 | `M8.4` | Payment UI/status và thông báo sau thanh toán |
| 36 | `M5.1` | AiProvider abstraction cho embedding |
| 37 | `M5.2` | Embedding worker và lưu pgvector |
| 38 | `M5.3` | RetrievalService vector search theo lesson |
| 39 | `M5.4` | Hybrid search cho công thức/ký hiệu |
| 40 | `M9.1` | AiModule structured output foundation |
| 41 | `M9.2` | Admin generate lesson summary |
| 42 | `M9.3` | Admin generate quiz/flashcard/test |
| 43 | `M9.4` | Student request-new reserve-first flow |
| 44 | `M9.5` | AI explanation cache inline |
| 45 | `M9.6` | Chat AI trong lesson bằng RAG |
| 46 | `M9.7` | Conversation summary và diagram placeholder |
| 47 | `M10.1` | Notification in-app API |
| 48 | `M10.2` | NotificationBell UI |
| 49 | `M10.3` | Socket.IO realtime notification |
| 50 | `M10.4` | Admin manual notification |
| 51 | `M10.5` | Automatic notification triggers |
| 52 | `M10.6` | Email/Zalo delivery workers |
| 53 | `M11.1` | Parent-child link và selected child |
| 54 | `M11.2` | Parent dashboard và progress view |
| 55 | `M11.3` | Parent course list và payment for child |
| 56 | `M11.4` | Parent notifications và news view |
| 57 | `M12.1` | Student report item |
| 58 | `M12.2` | Admin report moderation |
| 59 | `M12.3` | AI unreviewed content moderation |
| 60 | `M12.4` | News/events/livestream CRUD admin |
| 61 | `M12.5` | Student/parent news/events view |
| 62 | `M13.1` | XP events và level calculation |
| 63 | `M13.2` | Global student leaderboard |
| 64 | `M13.3` | Student profile editable fields |
| 65 | `M13.4` | Avatar upload integration |
| 66 | `M14.1` | Unit tests cho service quan trọng |
| 67 | `M14.2` | API tests cho flow nhạy cảm |
| 68 | `M14.3` | Playwright E2E cho flow chính |
| 69 | `M14.4` | Security hardening và rate limit |
| 70 | `M14.5` | Logging, monitoring và error tracking |
| 71 | `M14.6` | Docker Compose production, Nginx và health checks |
| 72 | `M14.7` | Backup/restore và vận hành production notes |

Ghi chú: `M8.x` được đặt trước `M5.x`/`M9.x` để MVP có thanh toán/học thủ công trước AI nâng cao. Khi làm AI/RAG vẫn phải giữ phụ thuộc `M4.x -> M5.x -> M9.x`.

---

## 4. Phụ thuộc chính

### Nền tảng

- `M0.2` phụ thuộc `M0.1`.
- `M1.x` phụ thuộc nền repo `M0.x`.
- `M1.6` phụ thuộc các model cần seed trong `M1.2` đến `M1.5`.
- `M2.1` phụ thuộc `M0.2` và `M1.1`.
- `M2.2` phụ thuộc `M1.2` và `M2.1`.
- `M2.3` phụ thuộc `M2.2`.

### Learning path/content

- `M3.1` phụ thuộc `M1.3`, `M2.3`.
- `M3.2` phụ thuộc `M3.1`.
- `M3.3` phụ thuộc `M3.1`, `M3.2`, `M2.3`.
- `M3.4` phụ thuộc API `M3.1`, `M3.2` và nền web.

### File/document/worker

- `M4.1` phụ thuộc `M1.2`, `M2.3`.
- `M4.2` phụ thuộc `M1.3`, `M4.1`.
- `M4.3` phụ thuộc background job model và Redis/Docker local.
- `M4.4` phụ thuộc `M4.2`, `M4.3`.

### Quiz/flashcard/test và student learning

- `M6.1` nên làm sau khi shared package có nền.
- `M6.2` đến `M6.4` phụ thuộc `M1.4`, `M2.3`, `M3.2`, `M6.1`.
- `M6.5` phụ thuộc `M6.2` đến `M6.4`, `M3.2`, `M2.3`.
- `M7.1` phụ thuộc `M1.3`, `M2.3`, `M3.2`, `M6.5`.
- `M7.2` đến `M7.4` phụ thuộc content tương ứng trong `M6.x` và `M7.1`.
- `M7.5` phụ thuộc attempts/progress từ `M7.2` đến `M7.4`.

### Payment

- `M8.1` phụ thuộc `M1.5`, `M2.3`, `M3.1`.
- `M8.2` phụ thuộc `M8.1`.
- `M8.3` phụ thuộc `M8.2`, enrollment model và webhook/payment models.
- `M8.4` phụ thuộc `M8.2`, `M8.3`; notification thật phụ thuộc `M10.1`.

### AI/RAG

- `M5.1` phụ thuộc nền API/env.
- `M5.2` phụ thuộc `M4.4`, `M5.1`, `M4.3`.
- `M5.3` phụ thuộc `M5.2`.
- `M5.4` phụ thuộc `M5.3`.
- `M9.1` phụ thuộc `M5.1`, background job/AI log models.
- `M9.2` đến `M9.6` phụ thuộc `M5.x`, `M9.1` và content/student flow liên quan.

### Notification/parent/report/gamification/testing

- `M10.x` phụ thuộc notification models, auth và các flow tạo event.
- `M11.x` phụ thuộc parent-child link, progress/payment/news tương ứng.
- `M12.x` phụ thuộc report/content/AI moderation/news models tương ứng.
- `M13.x` phụ thuộc learning progress/attempts/profile/file upload tương ứng.
- `M14.x` phụ thuộc các service/flow đã implement.

---

## 5. Khi nào đọc file milestone

Đọc file milestone tương ứng trong `docs/implementation/` khi:

- bắt đầu code một subtask cụ thể,
- cần biết phạm vi/Done của subtask,
- cần kiểm tra `Không làm` của subtask,
- cần cập nhật `.codex/plans/codex-execution-plan.md`.

Không cần đọc tất cả file milestone nếu chỉ cần chọn task tiếp theo; dùng index này và execution plan là đủ.
