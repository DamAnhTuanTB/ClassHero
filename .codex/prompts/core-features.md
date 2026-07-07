# Core Prompts Cho Codex

Dùng file này để giao các subtask tuyến tính trong `docs/09-implementation-plan.md`.

Nguyên tắc:

- Mỗi lần chỉ gửi một prompt.
- Ưu tiên ghi rõ mã subtask, ví dụ `M4.2`.
- Không gom nhiều subtask nếu owner không yêu cầu rõ.
- Codex phải tự đọc `AGENTS.md`, subtask trong `docs/09-implementation-plan.md`, và docs liên quan theo Task routing map.
- Nếu có `.codex/plans/codex-execution-plan.md`, Codex dùng file đó để kiểm tra thứ tự và phụ thuộc, không dùng để thay thế tài liệu gốc.
- Sau task có thay đổi file, Codex phải cập nhật changelog theo `AGENTS.md`.

## Prompt Khởi Động

```txt
Hãy làm M0.P theo docs/09-implementation-plan.md.

Yêu cầu:
- Đọc AGENTS.md.
- Đọc docs/01-product-scope.md.
- Đọc docs/03-technical-architecture.md.
- Đọc docs/04-database-model.md.
- Đọc docs/05-api-contract.md.
- Đọc docs/06-ai-rag-spec.md.
- Đọc docs/09-implementation-plan.md.
- Không sửa code production.
- Tạo/cập nhật .codex/plans/codex-execution-plan.md với: kiến trúc repo, thứ tự subtask, phụ thuộc, mâu thuẫn/TODO nếu có.
- Cập nhật changelog nếu có thay đổi file.

Sau khi xong, báo file đã tạo/sửa.
```

## Prompt Chuẩn Cho Một Subtask

```txt
Hãy làm <MÃ SUBTASK>: <TÊN SUBTASK>.

Trước khi code:
- Đọc AGENTS.md.
- Đọc đúng subtask trong docs/09-implementation-plan.md.
- Đọc docs liên quan theo Task routing map trong AGENTS.md.
- Nếu có .codex/plans/codex-execution-plan.md, kiểm tra thứ tự/phụ thuộc.
- Nêu kế hoạch ngắn: subtask, docs đã đọc, file/module dự kiến sửa, test dự kiến.

Phạm vi:
- Chỉ làm <MÃ SUBTASK>.
- Không làm sang subtask khác.
- Không đổi stack.
- Không thêm tính năng ngoài MVP.
- Nếu thiếu/mâu thuẫn thông tin, ghi TODO/ASSUMPTION hoặc hỏi lại.

Sau khi xong:
- Chạy format/lint/typecheck/test/build liên quan nếu có.
- Cập nhật docs liên quan nếu đổi database/API/AI behavior.
- Cập nhật changelog.
- Báo file đã sửa, lệnh đã chạy, test status, TODO còn lại.
```

## Prompt Làm Subtask Tiếp Theo

```txt
Hãy làm subtask tiếp theo theo .codex/plans/codex-execution-plan.md và docs/09-implementation-plan.md.

Trước khi code:
- Đọc AGENTS.md.
- Xác định subtask tiếp theo chưa làm.
- Đọc docs liên quan theo Task routing map.
- Nêu rõ subtask sẽ làm và những phần không làm trong lượt này.

Giữ phạm vi đúng một subtask, cập nhật changelog sau khi có thay đổi file.
```

## Catalog Subtask

Copy prompt chuẩn ở trên rồi thay `<MÃ SUBTASK>` và `<TÊN SUBTASK>` bằng một dòng dưới đây.

| Mã | Tên |
| --- | --- |
| `M0.P` | Đọc tài liệu và tạo execution plan |
| `M0.1` | Khởi tạo monorepo Turborepo |
| `M0.2` | Tooling, env example, Docker local và health check |
| `M1.1` | Setup Prisma và database foundation |
| `M1.2` | User, auth token, profile, file và background job models |
| `M1.3` | Learning path, lesson, material, document và enrollment models |
| `M1.4` | Quiz, flashcard, test, attempt và learning interaction models |
| `M1.5` | Payment, notification, report, AI log, gamification và news models |
| `M1.6` | Seed tối thiểu và database validation |
| `M2.1` | Backend foundation module |
| `M2.2` | Register, login, refresh và logout |
| `M2.3` | RBAC, `GET /me`, profile base và forgot/reset password |
| `M3.1` | Admin learning path API |
| `M3.2` | Admin lesson API |
| `M3.3` | Public/student learning path listing |
| `M3.4` | Admin learning path/lesson UI cơ bản |
| `M4.1` | FilesModule và R2 service |
| `M4.2` | Lesson document API |
| `M4.3` | BullMQ worker foundation |
| `M4.4` | PDF extract và chunking |
| `M5.1` | AiProvider abstraction cho embedding |
| `M5.2` | Embedding worker và lưu pgvector |
| `M5.3` | RetrievalService vector search theo lesson |
| `M5.4` | Hybrid search cho công thức/ký hiệu |
| `M6.1` | Rich text JSON và shared content schema |
| `M6.2` | Quiz CRUD API và admin UI tối thiểu |
| `M6.3` | Flashcard CRUD API và admin UI tối thiểu |
| `M6.4` | Test CRUD API và admin UI tối thiểu |
| `M6.5` | Student read-only lesson content API |
| `M7.1` | Access check, trial lesson và lesson page skeleton |
| `M7.2` | Quiz attempt và submit |
| `M7.3` | Flashcard progress, favorite và review |
| `M7.4` | Test start, submit và review |
| `M7.5` | Best attempt, lesson completion và top 5 |
| `M7.6` | Personal notes và private comments dưới video |
| `M8.1` | Discount code admin và validation |
| `M8.2` | Create payment order bằng payOS |
| `M8.3` | payOS webhook verify, idempotency và enrollment 12 tháng |
| `M8.4` | Payment UI/status và thông báo sau thanh toán |
| `M9.1` | AiModule structured output foundation |
| `M9.2` | Admin generate lesson summary |
| `M9.3` | Admin generate quiz/flashcard/test |
| `M9.4` | Student request-new reserve-first flow |
| `M9.5` | AI explanation cache inline |
| `M9.6` | Chat AI trong lesson bằng RAG |
| `M9.7` | Conversation summary và diagram placeholder |
| `M10.1` | Notification in-app API |
| `M10.2` | NotificationBell UI |
| `M10.3` | Socket.IO realtime notification |
| `M10.4` | Admin manual notification |
| `M10.5` | Automatic notification triggers |
| `M10.6` | Email/Zalo delivery workers |
| `M11.1` | Parent-child link và selected child |
| `M11.2` | Parent dashboard và progress view |
| `M11.3` | Parent course list và payment for child |
| `M11.4` | Parent notifications và news view |
| `M12.1` | Student report item |
| `M12.2` | Admin report moderation |
| `M12.3` | AI unreviewed content moderation |
| `M12.4` | News/events/livestream CRUD admin |
| `M12.5` | Student/parent news/events view |
| `M13.1` | XP events và level calculation |
| `M13.2` | Global student leaderboard |
| `M13.3` | Student profile editable fields |
| `M13.4` | Avatar upload integration |
| `M14.1` | Unit tests cho service quan trọng |
| `M14.2` | API tests cho flow nhạy cảm |
| `M14.3` | Playwright E2E cho flow chính |
| `M14.4` | Security hardening và rate limit |
| `M14.5` | Logging, monitoring và error tracking |
| `M14.6` | Docker Compose production, Nginx và health checks |
| `M14.7` | Backup/restore và vận hành production notes |
