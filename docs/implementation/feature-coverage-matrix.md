# Feature Coverage Matrix

File này giúp rà soát mỗi tính năng đã đủ lớp DB/API/UI/worker/test chưa. Source of truth chi tiết vẫn nằm trong docs domain và file milestone tương ứng.

Status dùng ngắn gọn:

```txt
Planned      Chưa làm hoặc chỉ có docs.
In progress  Đã có một phần code/docs nền.
Done         Đã hoàn thành theo Definition of Done.
Deferred     Chuyển sang version sau.
```

| Feature                        | DB                                                 | API                                                           | UI                                   | Worker/Integration               | Test/Check                                                            | Status      |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------ | -------------------------------- | --------------------------------------------------------------------- | ----------- |
| Repo/tooling local             | local Postgres `M0.2`                              | `M0.2`                                                        | `M0.1` web foundation                | Docker/Redis/pgvector `M0.2`     | `M0.2`                                                                | Done        |
| Prisma foundation              | `M1.1`, seed `M1.6`                                | -                                                             | -                                    | pgvector extension               | `M1.1`, `M1.6`                                                        | Done        |
| User/auth/profile foundation   | `M1.2` Done                                        | foundation `M2.1`, auth `M2.2` Done, profile/RBAC `M2.3` Done | `M2.4` UI connected to real auth API | Resend optional for reset email  | `M2.2`, `M2.3`, `M2.4 web/api typecheck + auth runtime curl`, `M14.2` | In progress |
| Public/student course browsing | `M1.3` Done                                        | `M3.1` minimal published list/detail, full `M3.3`             | `M3.5`                               | payment CTA `M8.4`               | `M3.1` focused API checks, `M14.3`                                    | In progress |
| Admin course/lesson management | `M1.3` Done                                        | `M3.1` Done, `M3.2`                                           | `M3.4`                               | -                                | `M3.1` focused API checks, `M14.1`, `M14.2`                           | In progress |
| Lesson document upload/PDF     | `M1.2` Done, `M1.3` Done                           | `M4.1`, `M4.2`                                                | `M4.5`                               | `M4.3`, `M4.4`                   | worker tests `M14.1`                                                  | In progress |
| Quiz CRUD and runner           | `M1.4` Done                                        | `M6.2`, `M7.2`                                                | `M6.2`, `M7.2`                       | AI explanation `M9.5`            | `M14.1`, `M14.3`                                                      | In progress |
| Flashcard CRUD and review      | `M1.4` Done                                        | `M6.3`, `M7.3`                                                | `M6.3`, `M7.3`                       | AI explanation `M9.5`            | `M14.1`, `M14.3`                                                      | In progress |
| Test CRUD and review           | `M1.4` Done                                        | `M6.4`, `M7.4`                                                | `M6.4`, `M7.4`                       | -                                | `M14.1`, `M14.3`                                                      | In progress |
| Student progress/dashboard     | `M1.3` Done, `M1.4` Done, `M1.5` Done              | `M7.5`                                                        | `M7.7`                               | notification/XP `M10.x`, `M13.x` | `M14.3`                                                               | In progress |
| Student notes/private comments | `M1.4` Done                                        | `M7.6`                                                        | `M7.6`                               | file image optional `M4.1`       | `M14.1`                                                               | In progress |
| Discount/payment/enrollment    | `M1.3` Done, `M1.5` Done                           | `M8.1`, `M8.2`, `M8.3`                                        | `M8.4`, `M8.5`                       | payOS webhook                    | `M14.2`                                                               | In progress |
| Embedding/retrieval            | `M1.3` Done, pgvector                              | `M5.3`, `M5.4`                                                | -                                    | `M5.1`, `M5.2`                   | AI/RAG validation                                                     | In progress |
| AI generation/explanation/chat | `M1.4` Done, `M1.5` Done                           | `M9.2`-`M9.7`                                                 | `M9.6`, `M9.8`                       | OpenAI/Gemini provider, RAG      | schema validation                                                     | In progress |
| Notification                   | `M1.5` Done                                        | `M10.1`, `M10.4`                                              | `M10.2`                              | Socket.IO, email/Zalo workers    | `M14.2`                                                               | In progress |
| Parent portal                  | `M1.2` Done, `M1.3` Done, `M1.4` Done, `M1.5` Done | `M11.1`-`M11.4`                                               | `M11.1`-`M11.4`                      | payment/news integration         | `M14.3`                                                               | In progress |
| Report/moderation/news         | `M1.5` Done                                        | `M12.1`-`M12.5`                                               | `M12.2`-`M12.5`                      | AI moderation `M12.3`            | `M14.1`, `M14.3`                                                      | In progress |
| Gamification/profile/avatar    | `M1.2` Done, `M1.5` Done                           | `M13.1`-`M13.4`                                               | `M13.2`-`M13.5`                      | avatar upload `M4.1`             | `M14.1`                                                               | In progress |
| Production hardening/deploy    | all relevant                                       | all sensitive flows                                           | critical E2E flows                   | Docker/Nginx/backup              | `M14.x`                                                               | Planned     |

## Khi nào cập nhật file này

- Khi thêm, xóa, hoãn hoặc đổi phạm vi feature.
- Khi hoàn thành một task làm thay đổi status feature.
- Khi phát hiện feature thiếu DB/API/UI/worker/test task.

Không dùng file này để tự thêm scope ngoài MVP. Nếu matrix thiếu task, cập nhật docs milestone trước hoặc cùng lúc.
