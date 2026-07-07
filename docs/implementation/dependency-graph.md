# Implementation Dependency Graph

File này là bản đồ phụ thuộc dạng đọc nhanh. Source of truth chi tiết vẫn là `docs/09-implementation-plan.md` và `docs/implementation/M*.md`.

## 1. Luồng chính

```txt
M0 repo/tooling
  -> M1 database foundation/models/seed
    -> M2 auth/RBAC
      -> M3 course/lesson
        -> M4 file/document/worker foundation
          -> M5 embedding/retrieval
            -> M9 AI generation/chat

M3 course/lesson + M6 quiz/flashcard/test
  -> M7 student learning flow
    -> M10 notification triggers
    -> M13 XP/profile/leaderboard

M3 course/lesson + M8 payment/enrollment
  -> M7 access learning
  -> M11 parent payment/progress

M10 notification + M12 news/report
  -> student/parent/admin notification surfaces

M14 testing/hardening/deploy
  -> depends on implemented flows
```

## 2. Phụ thuộc theo milestone

| Milestone | Phụ thuộc chính | Mở khóa |
| --- | --- | --- |
| `M0` | Docs/project decision | Repo, tooling, Docker local |
| `M1` | `M0` | Schema/model nền cho toàn hệ thống |
| `M2` | `M1.2`, `M2.1` | Auth, RBAC, profile, protected APIs |
| `M3` | `M1.3`, `M2.3` | Course/lesson APIs và UI public/student/admin |
| `M4` | `M1.2`, `M1.3`, `M2.3`, `M3.2` | Upload, document API, worker, PDF processing |
| `M5` | `M4.4`, API/env nền | Embedding, pgvector retrieval, hybrid search |
| `M6` | `M1.4`, `M2.3`, `M3.2` | Quiz/flashcard/test CRUD và read-only lesson content |
| `M7` | `M3.2`, `M6.5`, `M2.3` | Student lesson flow, attempts, progress, dashboard |
| `M8` | `M1.5`, `M2.3`, `M3.1` | Discount, payment order, webhook, enrollment |
| `M9` | `M5.x`, `M9.1`, content modules | AI generate, explanation cache, lesson chat |
| `M10` | Notification models, auth, event sources | In-app/realtime/email/Zalo notification |
| `M11` | Parent-child link, progress/payment/news APIs | Parent portal |
| `M12` | Report/news models, auth, content modules | Report moderation, news/events |
| `M13` | Progress/attempt/profile/file models | XP, leaderboard, profile, admin dashboard |
| `M14` | Implemented sensitive flows | Tests, hardening, deploy, operations |

## 3. Phụ thuộc cần nhớ khi chọn task

- `M2.4` auth UI có thể làm mock sau `M0.2`, nhưng nối API thật cần `M2.2` và `M2.3`.
- `M3.5` public/student course UI cần `M3.3`; CTA mua thật cần `M8.4`.
- `M4.5` upload UI cần `M4.1`, `M4.2`, `M4.3`; status extract/chunk đầy đủ cần `M4.4`.
- `M7.1` lesson page skeleton cần `M6.5` để đọc lesson content.
- `M8.4` payment UI cần `M8.2` và `M8.3`; notification thật có thể chờ `M10.1`.
- `M9.6` AI chat chỉ nên hoàn thiện sau `M4.4`, `M5.2`, `M5.3` và `M9.1`.
- `M13.5` admin dashboard có thể dùng placeholder cho metric chưa có API, nhưng phải ghi rõ.

## 4. Khi nào cập nhật file này

Cập nhật khi thêm/xóa/hoãn task, đổi thứ tự milestone hoặc phát hiện dependency mới trong lúc code.
