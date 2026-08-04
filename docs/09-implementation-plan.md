# 09. Implementation Plan - Index triển khai

File này là bản index nhẹ để Codex chọn đúng subtask, thứ tự và phụ thuộc.

Chi tiết `Mode`, phạm vi, `Không làm` và `Done khi` từng subtask nằm trong từng file milestone:

```txt
docs/implementation/M0.md
docs/implementation/M1.md
...
docs/implementation/M15.md
```

Nếu cần xem cách map nhanh, mở `docs/implementation/README.md`.

Nếu muốn đọc diễn giải dễ hiểu theo milestone lớn `M0` đến `M15`, mở `docs/implementation/milestone-overview.md`.

Nếu cần xem phụ thuộc hoặc coverage theo feature nhanh hơn, mở thêm:

```txt
docs/implementation/dependency-graph.md
docs/implementation/feature-coverage-matrix.md
```

Khi làm task, Codex đọc file index này trước. Sau khi xác định mã subtask, mở đúng file milestone tương ứng. Ví dụ `M8.3` thì đọc `docs/implementation/M8.md`.

`Mode` dùng để chọn phạm vi kỹ thuật của subtask:

```txt
UI only             Chỉ giao diện/mock UI.
API only            Backend/API/service, không làm UI nếu task không yêu cầu.
UI + API            Có cả UI và API; mặc định làm bằng `/task-full` nếu flow đã rõ.
DB only             Prisma/schema/migration/seed.
Worker/Integration  Worker, queue, storage, AI, payment, realtime, deploy/tooling.
Docs only           Chỉ tài liệu/kế hoạch.
```

`Mode` không có nghĩa là luôn phải chia nhỏ task thành từng phần rời rạc. Chiến lược mặc định là làm theo lát dọc hoàn chỉnh khi phạm vi đã rõ: database/API/worker/UI nào cần cho subtask thì làm đủ trong cùng `/task-full`, miễn không vượt scope.

Chỉ tách `/task-ui` trước rồi `/task-connect` khi:

- Owner muốn xem/chốt UI bằng mock data trước.
- Màn hình phức tạp hoặc dễ cần chỉnh gu thiết kế.
- API chưa sẵn sàng nhưng cần dựng giao diện để review luồng.
- Owner yêu cầu rõ UI-first.

---

## 1. Nguyên tắc triển khai

- Không làm tính năng ngoài MVP.
- Không đổi stack công nghệ đã chốt.
- Mỗi lần owner giao task mặc định chỉ làm một subtask.
- Với subtask đã rõ scope, ưu tiên `/task-full` để hoàn thành một lát dọc có thể kiểm tra được.
- Không chia nhỏ UI/API/DB một cách máy móc nếu việc làm trọn task giúp kiểm tra flow nhanh và an toàn hơn.
- Dùng `/task-ui` trước chỉ khi cần chốt giao diện/mock UI; sau khi UI ổn mới dùng `/task-connect` để code API đầy đủ và nối dữ liệu thật.
- Nếu task ngắn chưa ghi rõ subtask, Codex map vào subtask gần nhất rồi nêu giả định.
- Nếu task có thể thuộc nhiều subtask, hỏi lại hoặc ghi `ASSUMPTION` trước khi code.
- Nếu một subtask quá lớn, đề xuất chia nhỏ hơn trước khi code.
- Database/API/AI/env/UI behavior đổi phải cập nhật docs liên quan theo `AGENTS.md`.
- Task có sửa code phải đọc `docs/14-source-code-structure.md` trước khi tạo file mới hoặc di chuyển file, để chọn đúng shared/feature/domain layer và tránh gom component/helper/service vào một chỗ.
- Không cập nhật changelog trong task thường; changelog chỉ ghi trong workflow `/commit`.

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
4. Đọc dòng `Mode` của subtask để xác định task có UI/API/DB/worker/docs hay không.
5. Nếu task có sửa code, đọc `docs/14-source-code-structure.md` để xác định route/feature/shared/domain layer, alias import và boundary tách file.
6. Nếu subtask có UI, đọc thêm bảng screen coverage trong `docs/08-ui-pages-and-components.md` để biết task UI/API/DB/worker liên quan.
7. Đọc docs liên quan theo `Task routing map` trong `AGENTS.md`.
8. Nêu kế hoạch ngắn, gồm cả cấu trúc file/layer dự kiến và phần sẽ tái sử dụng thay vì tạo mới.
9. Code đúng phạm vi subtask và đúng chiến lược owner chọn:
   - `/task-full`: làm đủ lát dọc trong scope subtask.
   - `/task-ui`: chỉ UI/mock data.
   - `/task-connect`: code API đầy đủ nếu thiếu rồi nối UI đã có với dữ liệu thật.
10. Chạy check phù hợp. Changelog chỉ được ghi nếu owner yêu cầu `/commit`.

### Khi owner giao task ngắn

Codex không code ngay nếu phạm vi chưa rõ. Cần:

1. Tự map vào milestone/subtask gần nhất.
2. Nêu subtask đề xuất và mode phù hợp: `/task-ui`, `/task-connect`, hoặc `/task-full`.
3. Chỉ code khi phạm vi đủ rõ.

---

## 3. Thứ tự subtask khuyến nghị

Thứ tự này ưu tiên nền tảng trước tính năng sau. Nếu `.codex/plans/codex-execution-plan.md` có cập nhật mới hơn, dùng file đó để kiểm tra phụ thuộc, nhưng vẫn không thay thế docs gốc.

| Thứ tự | Mã      | Tên                                                                     |
| ------ | ------- | ----------------------------------------------------------------------- |
| 1      | `M0.P`  | Đọc tài liệu và tạo execution plan                                      |
| 2      | `M0.1`  | Khởi tạo monorepo Turborepo                                             |
| 3      | `M0.2`  | Tooling, env example, Docker local và health check                      |
| 4      | `M1.1`  | Setup Prisma và database foundation                                     |
| 5      | `M1.2`  | User, auth token, profile, file và background job models                |
| 6      | `M1.3`  | Learning path, chapter, lesson, material, document và enrollment models |
| 7      | `M1.4`  | Quiz, flashcard, test, attempt và learning interaction models           |
| 8      | `M1.5`  | Payment, notification, report, AI log, gamification và news models      |
| 9      | `M1.6`  | Seed tối thiểu và database validation                                   |
| 10     | `M2.1`  | Backend foundation module                                               |
| 11     | `M2.2`  | Register, login, refresh và logout                                      |
| 12     | `M2.3`  | RBAC, `GET /me`, profile base và forgot/reset password                  |
| 13     | `M2.4`  | Auth UI login/register/forgot password                                  |
| 14     | `M3.1`  | Admin learning path API                                                 |
| 15     | `M3.2`  | Admin chapter và lesson API                                             |
| 16     | `M3.3`  | Public/student learning path listing                                    |
| 17     | `M3.4`  | Admin learning path/chapter/lesson UI cơ bản                            |
| 18     | `M3.5`  | Public/student course browsing UI                                       |
| 18.1   | `M3.9`  | Catalog lĩnh vực và đối tượng hướng đến khóa học                        |
| 19     | `M4.1`  | FilesModule và storage service                                          |
| 20     | `M4.2`  | Source document và lesson page mapping API                              |
| 21     | `M4.3`  | BullMQ worker foundation                                                |
| 22     | `M4.4`  | Paid OCR artifact và chunking                                           |
| 23     | `M4.5`  | Lesson document upload UI/status                                        |
| 23.1   | `M4.6`  | OCR accounting, retry-resume và budget guard                            |
| 24     | `M6.1`  | Rich text JSON và shared content schema                                 |
| 25     | `M6.2`  | Quiz CRUD API và admin UI tối thiểu                                     |
| 26     | `M6.3`  | Flashcard CRUD API và admin UI tối thiểu                                |
| 27     | `M6.4`  | Test CRUD API và admin UI tối thiểu                                     |
| 28     | `M6.5`  | Student read-only lesson content API                                    |
| 29     | `M7.1`  | Access check, trial lesson và lesson page skeleton                      |
| 30     | `M7.2`  | Quiz attempt và submit                                                  |
| 31     | `M7.3`  | Flashcard progress, favorite và review                                  |
| 32     | `M7.4`  | Test start, submit và review                                            |
| 33     | `M7.5`  | Best attempt, lesson completion và top 5                                |
| 34     | `M3.8`  | Admin lesson video transcript                                           |
| 35     | `M15.1` | Video watch progress, watched intervals và smart resume                 |
| 36     | `M7.6`  | Personal notes và private comments dưới video                           |
| 37     | `M15.2` | Synced transcript, timestamp notes và chapter learning context          |
| 38     | `M15.3` | In-video checkpoints và chapter mastery                                 |
| 39     | `M7.7`  | Student dashboard UI                                                    |
| 40     | `M8.1`  | Discount code admin và validation                                       |
| 41     | `M8.2`  | Create payment order bằng payOS                                         |
| 42     | `M8.3`  | payOS webhook verify, idempotency và enrollment 12 tháng                |
| 43     | `M8.4`  | Payment UI/status và thông báo sau thanh toán                           |
| 44     | `M8.5`  | Admin discount code UI                                                  |
| 45     | `M5.1`  | AiProvider abstraction cho embedding                                    |
| 46     | `M5.2`  | Embedding worker và lưu pgvector                                        |
| 47     | `M5.3`  | RetrievalService vector search theo lesson                              |
| 48     | `M5.4`  | Hybrid search cho công thức/ký hiệu                                     |
| 49     | `M9.1`  | AiModule structured output foundation                                   |
| 50     | `M9.2`  | Admin generate lesson summary                                           |
| 51     | `M9.3`  | Admin generate quiz/flashcard/test                                      |
| 52     | `M9.8`  | Admin AI generation panel UI — Done 2026-08-03                          |
| 52.1   | `M9.9`  | Provider catalog, AI routing, Gemini fallback và usage accounting       |
| 52.2   | `M9.10` | Admin provider operations API                                           |
| 52.3   | `M9.11` | Admin Cài đặt AI/OCR UI                                                 |
| 52.4   | `M9.12` | Hard-stop ngân sách tuyệt đối bằng reservation                          |
| 53     | `M9.4`  | Student request-new reserve-first UI + API                              |
| 54     | `M9.5`  | AI explanation cache inline UI + API                                    |
| 55     | `M9.6`  | Chat AI trong lesson bằng RAG                                           |
| 56     | `M9.7`  | Conversation summary và diagram placeholder                             |
| 57     | `M15.4` | Contextual AI `Hỏi đoạn này` và `Em chưa hiểu`                          |
| 58     | `M15.5` | AI chapter summary và flashcard từ video                                |
| 59     | `M15.6` | Semantic search inside video                                            |
| 60     | `M15.7` | Adaptive review recommendations và difficulty signals                   |
| 61     | `M15.8` | Admin video learning analytics                                          |
| 62     | `M10.1` | Notification in-app API                                                 |
| 63     | `M10.2` | NotificationBell UI và notification page                                |
| 64     | `M10.3` | Socket.IO realtime notification                                         |
| 65     | `M10.4` | Admin manual notification                                               |
| 66     | `M10.5` | Automatic notification triggers                                         |
| 67     | `M10.6` | Email/Zalo delivery workers                                             |
| 68     | `M11.1` | Parent-child link và selected child                                     |
| 69     | `M11.2` | Parent dashboard và progress view                                       |
| 70     | `M11.3` | Parent course list và payment for child                                 |
| 71     | `M11.4` | Parent notifications và news view                                       |
| 72     | `M12.1` | Student report item                                                     |
| 73     | `M12.2` | Admin report moderation                                                 |
| 74     | `M12.3` | AI unreviewed content moderation                                        |
| 75     | `M12.4` | News/events/livestream CRUD admin                                       |
| 76     | `M12.5` | Student/parent news/events view                                         |
| 77     | `M13.1` | XP events và level calculation                                          |
| 78     | `M13.2` | Global student leaderboard                                              |
| 79     | `M13.3` | Student profile editable fields                                         |
| 80     | `M13.4` | Avatar upload integration                                               |
| 81     | `M13.5` | Admin dashboard overview UI                                             |
| 82     | `M14.1` | Unit tests cho service quan trọng                                       |
| 83     | `M14.2` | API tests cho flow nhạy cảm                                             |
| 84     | `M14.3` | Playwright E2E cho flow chính                                           |
| 85     | `M14.4` | Security hardening và rate limit                                        |
| 86     | `M14.5` | Logging, monitoring và error tracking                                   |
| 87     | `M14.6` | Docker Compose production, Nginx và health checks                       |
| 88     | `M14.7` | Backup/restore và vận hành production notes                             |
| 89     | `M3.6`  | Personal learning path clone foundation                                 |
| 90     | `M3.7`  | Admin personal learning path management UI                              |
| 91     | `M7.8`  | Student personalized learning path access và progress                   |
| 92     | `M11.5` | Parent personalized learning path view                                  |
| 93     | `M14.8` | Frontend loading, prefetch và transition hardening                      |

Ghi chú:

- `M15.1-M15.3` được ưu tiên ngay sau cụm học sinh cốt lõi `M7.1-M7.5`; `M15.2` đi sau nền ghi chú `M7.6`.
- `M15.4-M15.8` vẫn thuộc cùng milestone nhưng được đặt sau `M5.x/M9.x` vì cần retrieval, AI validation/cache hoặc dữ liệu tích lũy từ phần nền tảng.
- `M3.8` là prerequisite của các subtask M15 dùng transcript/chapter và được đặt ngay trước phần nền M15.
- `M8.x` được đặt trước `M5.x`/`M9.x` để MVP có thanh toán/học thủ công trước AI nâng cao. Khi làm AI/RAG vẫn phải giữ phụ thuộc `M4.x -> M5.x -> M9.x`.

---

## 4. Phụ thuộc chính

### Nền tảng

- `M0.2` phụ thuộc `M0.1`.
- `M1.x` phụ thuộc nền repo `M0.x`.
- `M1.6` phụ thuộc các model cần seed trong `M1.2` đến `M1.5`.
- `M2.1` phụ thuộc `M0.2` và `M1.1`.
- `M2.2` phụ thuộc `M1.2` và `M2.1`.
- `M2.3` phụ thuộc `M2.2`.
- `M2.4` phụ thuộc `M2.2`, `M2.3` nếu nối API thật; có thể làm `/task-ui M2.4` mock trước.

### Learning path/content

- `M3.1` phụ thuộc `M1.3`, `M2.3`.
- `M3.2` phụ thuộc `M3.1`.
- `M3.3` phụ thuộc `M3.1`, `M3.2`, `M2.3`.
- `M3.4` phụ thuộc API `M3.1`, `M3.2` và nền web.
- `M3.5` phụ thuộc `M3.3`; payment CTA thật phụ thuộc `M8.4`.
- `M3.6` phụ thuộc `M3.1`, `M3.2`, `M4.3` và enrollment thật từ `M8.3`.
- `M3.7` phụ thuộc `M3.4`, `M3.6`.
- `M3.8` phụ thuộc `M3.2`, `M3.4`; transcript là optional và không chặn phát video.
- `M3.9` phụ thuộc `M3.1`, `M3.4`; thay enum môn/lớp của khóa học bằng catalog Lĩnh vực và Đối tượng hướng đến.
- Từ M3 trở đi, lesson luôn thuộc một learning path và có thể thuộc chapter hoặc không. Chapter là lớp nhóm tổng quan tùy chọn; course detail dùng `structureItems` để chapter và lesson top-level xen kẽ, còn lesson trong chapter giữ thứ tự con riêng.

### File/document/worker

- `M4.1` phụ thuộc `M1.2`, `M2.3`.
- `M4.2` phụ thuộc `M1.3`, `M4.1`.
- `M4.3` phụ thuộc background job model và Redis/Docker local.
- `M4.4` phụ thuộc `M4.2`, `M4.3`.
- `M4.5` phụ thuộc `M4.1`, `M4.2`, `M4.3`; trạng thái chunk/ready đầy đủ phụ thuộc `M4.4`.
- `M4.6` phụ thuộc `M4.4`, provider operations schema của `M9.9`; hoàn thiện cost event, cache saving, budget và retry-resume Mathpix.

### Quiz/flashcard/test và student learning

- `M6.1` nên làm sau khi shared package có nền.
- `M6.2` đến `M6.4` phụ thuộc `M1.4`, `M2.3`, `M3.2`, `M6.1`; quiz/flashcard/test chỉ gắn với lesson, không gắn với chapter.
- `M6.5` phụ thuộc `M6.2` đến `M6.4`, `M3.2`, `M2.3`.
- `M7.1` phụ thuộc `M1.3`, `M2.3`, `M3.2`, `M6.5`.
- `M7.2` đến `M7.4` phụ thuộc content tương ứng trong `M6.x` và `M7.1`.
- `M7.5` phụ thuộc attempts/progress từ `M7.2` đến `M7.4`.
- `M7.7` phụ thuộc `M7.5`; notification/XP thật phụ thuộc `M10.x`/`M13.x`.
- `M7.8` phụ thuộc `M3.6`, `M7.1`, `M7.5`; quiz/flashcard/test history đầy đủ phụ thuộc các task runner tương ứng.

### Payment

- `M8.1` phụ thuộc `M1.5`, `M2.3`, `M3.1`.
- `M8.2` phụ thuộc `M8.1`.
- `M8.3` phụ thuộc `M8.2`, enrollment model và webhook/payment models.
- `M8.4` phụ thuộc `M8.2`, `M8.3`; notification thật phụ thuộc `M10.1`.
- `M8.5` phụ thuộc `M8.1`.

### AI/RAG

- `M5.1` phụ thuộc nền API/env.
- `M5.2` phụ thuộc `M4.4`, `M5.1`, `M4.3`.
- `M5.3` phụ thuộc `M5.2`.
- `M5.4` phụ thuộc `M5.3`.
- `M9.1` phụ thuộc `M5.1`, background job/AI log models.
- `M9.2` phụ thuộc `M5.3`, `M9.1` và lesson content.
- `M9.3` phụ thuộc `M6.2-M6.4`, `M5.3`, `M9.1`.
- `M9.8` phụ thuộc `M9.2`, `M9.3`; job status UI phụ thuộc `M4.3`. Task này
  được xếp ngay sau `M9.3` để admin có UI kiểm thử generation trước khi làm
  luồng học sinh; đã Done ngày 2026-08-03, task kế tiếp là `M9.4`.
- `M9.4` phụ thuộc `M9.3`, `M6.2-M6.4`, `M7.1-M7.4` theo loại nội dung và phải
  nối luôn các action request-new hiện có trên UI học sinh.
- `M9.5` phụ thuộc `M9.1`, `M5.3`, `M6.2-M6.4`, `M7.2-M7.4` và phải có inline
  explanation UI trong cùng task.
- `M9.6` phụ thuộc `M5.4`, `M9.1`, `M7.1`; triển khai sau `M9.5` để nhận context
  từ action `Chat thêm với AI`.
- `M9.7` phụ thuộc `M9.6`.
- `M9.9` phụ thuộc `M9.1` và nền Prisma/job; tạo catalog/price/usage, snapshot routing, OpenAI/Gemini fallback và cost calculator.
- `M9.10` phụ thuộc `M9.9`, cung cấp RBAC API cho cấu hình, giá, budget, thống kê và audit.
- `M9.11` phụ thuộc `M9.10` và admin shell; nối route `/admin/ai-settings` với dữ liệu thật.
- `M9.12` phụ thuộc `M9.9-M9.11` và `M4.6`; harden toàn bộ paid-call gateway bằng reservation nguyên tử, fail-closed, lỗi không retry và UI số dư ngân sách.

### Smart video learning

- M15 là scope mở rộng đã được owner duyệt, ưu tiên sau khi `M7.1`, `M7.2`, `M7.4`, `M7.5` hoàn tất; `M7.3` nên hoàn tất cùng cụm nền để tái sử dụng flashcard.
- `M15.1` phụ thuộc `M3.8`, `M6.5`, `M7.1`, `M7.5`.
- `M15.2` phụ thuộc `M3.8`, `M7.6`, `M15.1`.
- `M15.3` phụ thuộc `M3.8`, `M7.2`, `M7.4`, `M7.5`, `M15.1`.
- `M15.4` phụ thuộc `M3.8`, `M5.3`, `M9.1`, `M9.6`, `M15.1`.
- `M15.5` phụ thuộc `M3.8`, `M6.3`, `M9.1`, `M9.2`, `M9.3`, `M15.2`.
- `M15.6` phụ thuộc `M3.8`, `M5.2`, `M5.3`, `M5.4`.
- `M15.7` phụ thuộc `M7.2-M7.4`, `M15.1`, `M15.3`, `M15.4`.
- `M15.8` phụ thuộc `M15.1`, `M15.3`, `M15.7`.

### Notification/parent/report/gamification/testing

- `M10.x` phụ thuộc notification models, auth và các flow tạo event.
- `M11.x` phụ thuộc parent-child link, progress/payment/news tương ứng.
- `M11.5` phụ thuộc `M7.8`, `M11.1`, `M11.2`.
- `M12.x` phụ thuộc report/content/AI moderation/news models tương ứng.
- `M13.x` phụ thuộc learning progress/attempts/profile/file upload tương ứng.
- `M13.5` phụ thuộc các module dashboard muốn hiển thị; có thể dùng placeholder cho metric chưa có.
- `M14.x` phụ thuộc các service/flow đã implement.
- `M14.8` chỉ audit/sửa các screen đã có; regression E2E mở rộng phối hợp với
  `M14.3`, còn editor/media nặng chỉ preload khi intent và bundle budget cho
  phép.

---

## 5. Khi nào đọc file milestone

Đọc file milestone tương ứng trong `docs/implementation/` khi:

- bắt đầu code một subtask cụ thể,
- cần biết phạm vi/Done của subtask,
- cần kiểm tra `Không làm` của subtask,
- cần cập nhật `.codex/plans/codex-execution-plan.md`.

Không cần đọc tất cả file milestone nếu chỉ cần chọn task tiếp theo; dùng index này và execution plan là đủ.
