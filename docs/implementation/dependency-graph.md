# Implementation Dependency Graph

File này tổng hợp dependency để đọc nhanh. Scope/`Done khi` của task vẫn nằm
trong `docs/implementation/M*.md`; thứ tự triển khai nằm trong
`docs/09-implementation-plan.md`.

## 1. Luồng chính

```txt
M0 repo/tooling
  -> M1 database foundation/models/seed
    -> M2 auth/RBAC
      -> M3 course/chapter/lesson
        -> M4 file/document/worker foundation
          -> M5 embedding/retrieval
            -> M9 AI generation/chat

M3 course/chapter/lesson + M6 quiz/flashcard/test
  -> M7 student learning flow
    -> M15.1-M15.3 smart video foundation
    -> M10 notification triggers
    -> M13 XP/profile/leaderboard

M3.8 transcript/chapter + M7 student learning + M5 retrieval + M9 AI
  -> M15 smart video learning
    -> watch progress/resume/timestamp notes/checkpoints
    -> contextual AI/semantic search/adaptive review
    -> aggregate admin video analytics

M3.8 transcript/chapter + M4.3 jobs + M9 provider/routing/budget/target context
  -> M9.7 admin whole-video summary

M3 course/chapter/lesson + M8 payment/enrollment
  -> full paid enrollment access and payment CTA after M8.4
  -> M3.6 private personalized clone
    -> M3.7 admin management
    -> M7.8 student effective curriculum/progress
      -> M11.5 parent read view
  -> M11 parent payment/progress

M10 notification + M12 news/report
  -> student/parent/admin notification surfaces

M14 testing/hardening/deploy
  -> depends on implemented flows
  -> M14.8 frontend loading/prefetch hardening audits only existing screens
```

## 2. Phụ thuộc theo milestone

| Milestone | Phụ thuộc chính                                                                                                                    | Mở khóa                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `M0`      | Docs/project decision                                                                                                              | Repo, tooling, Docker local                                                                    |
| `M1`      | `M0`                                                                                                                               | Schema/model nền cho toàn hệ thống                                                             |
| `M2`      | `M1.2`, `M2.1`                                                                                                                     | Auth, RBAC, profile, protected APIs                                                            |
| `M3`      | `M1.3`, `M2.3`                                                                                                                     | Course/chapter/lesson APIs và UI public/student/admin                                          |
| `M4`      | `M1.2`, `M1.3`, `M2.3`, `M3.2`                                                                                                     | Upload, lesson document API, worker, PDF processing                                            |
| `M5`      | `M4.4`, API/env nền                                                                                                                | Embedding, pgvector retrieval, hybrid search                                                   |
| `M6`      | `M1.4`, `M2.3`, `M3.2`                                                                                                             | Quiz/flashcard/test CRUD và read-only lesson content                                           |
| `M7`      | `M3.2`, `M6.5`, `M2.3`                                                                                                             | Student lesson flow, attempts, progress, dashboard                                             |
| `M8`      | `M1.5`, `M2.3`, `M3.1`                                                                                                             | Discount, payment order, webhook, enrollment                                                   |
| `M9`      | `M5.x`, `M9.1`, content modules                                                                                                    | AI generate, explanation cache, lesson chat                                                    |
| `M10`     | Notification models, auth, event sources                                                                                           | In-app/realtime/email/Zalo notification                                                        |
| `M11`     | Parent-child link, progress/payment/news APIs                                                                                      | Parent portal                                                                                  |
| `M12`     | Report/news models, auth, content modules                                                                                          | Report moderation, news/events                                                                 |
| `M13`     | Progress/attempt/profile/file models                                                                                               | XP, leaderboard, profile, admin dashboard                                                      |
| `M14`     | Implemented sensitive flows                                                                                                        | Tests, hardening, deploy, operations                                                           |
| `M15`     | `M3.8`, core `M7.1-M7.5`; AI tasks additionally need `M5.x`, `M9.x`; Student Video Summary `M15.10` cần admin Video Summary `M9.7` | Smart video progress, contextual learning, adaptive review, student video summary và analytics |

## 3. Phụ thuộc cần nhớ khi chọn task

- `M2.4` auth UI có thể làm mock sau `M0.2`, nhưng nối API thật cần `M2.2` và `M2.3`.
- `M3.5` public/student course UI cần `M3.3`; CTA mua thật cần `M8.4`.
- Course detail từ M3.3/M3.5 dùng ordered `structureItems`: chapter và lesson không thuộc chapter có thể xen kẽ, chapter chứa lessons con; lesson vẫn là đơn vị nội dung bắt buộc thuộc learning path.
- `M4.5` source document upload/page mapping UI cần `M4.1`, `M4.2`, `M4.3`; paid OCR artifact/page-level content và chunk theo lesson đầy đủ cần `M4.4`.
- `M7.1` lesson page skeleton cần `M6.5` để đọc lesson content.
- `M6.6` đi sau M6.2/M6.4 và Quiz figure/refinement/generation nền M9.3;
  dependency này chỉ áp dụng Admin Test/worker target. M7.4-M7.5 giữ attempt,
  timer, best-score và completion riêng, không bị thay bằng Quiz runner.
- Sau M6.6, capability Admin/AI/figure mới cho Test phải đi qua Assessment/Quiz
  core; `durationSeconds` chỉ được lấy từ TestSet, không được thêm vào AI modal
  hoặc prompt contract.
- `M8.4` payment UI cần `M8.2` và `M8.3`; notification thật có thể chờ `M10.1`.
- Thứ tự triển khai cụm AI là
  `M9.1 -> M9.2 (Summary + TeX/TikZ) -> M9.8 -> M9.17 -> M9.18 -> M9.19 -> M9.20 -> M9.21 -> M9.22 -> M9.23 -> M9.24 -> M9.25 -> M9.26 -> M9.27 -> M9.7 -> M9.4 -> M9.5 -> M9.6`.
- Provider operations là lát dọc độc lập:
  `M9.9 -> M4.6 -> M9.10 -> M9.11 -> M9.12`; dùng nền `M9.1`, `M4.4` và admin shell. `M9.12` là bước hardening cuối, phải hoàn tất trước khi coi hard-stop là giới hạn tuyệt đối trong production.
  `M9.8` đứng ngay sau `M9.3` để admin kiểm thử generation trên UI và đã Done
  ngày 2026-08-03; mã task không đổi để giữ ổn định lịch sử tham chiếu.
- `M9.2` hiện bao gồm PDF packet chấp nhận cả scan thuần và text layer, exact request draft, multimodal
  reference và TeX/TikZ Summary lớp 3–12. Nó phụ thuộc `M4.1` storage, `M4.3`
  BullMQ, `M4.4` OCR artifact/page mapping, `M9.1` provider foundation và admin
  panel `M9.8`; Summary mới không còn phụ thuộc retrieval chunks `M5.3`.
- `M9.17` phụ thuộc `M9.2`, panel `M9.8` và image manifest `M4.4`; chỉ thêm
  execution mode dùng crop SGK trực tiếp, không thay output Phase 1 hoặc chặn
  các student flow `M9.4-M9.6` hoặc admin Video Summary `M9.7`.
- `M9.18` phụ thuộc `M9.17`, figure revision/R2 của `M9.2` và action frame
  `M9.8`; editor chỉ áp dụng raster SGK thành công, preview/apply local và không
  thêm AI provider hay background job.
- `M9.19` phụ thuộc provider catalog/routing `M9.9`, ADMIN API `M9.10`, màn
  Cài đặt AI `M9.11` và reservation fail-closed `M9.12`.
- `M9.20` phụ thuộc hai pipeline phase hiện có `M9.2/M9.3`, panel generation
  `M9.8`, provider operations `M9.9-M9.12` và token config `M9.19`; mở rộng khóa
  config từ feature thành `(feature, purpose)` và snapshot riêng text/ảnh.
- `M9.32` phụ thuộc provider usage `M9.9-M9.12` và inventory các call path
  `M9.2-M9.7`, `M9.21-M9.31`; các pipeline AI mới phải truyền target context vào
  gateway chung trước call. Task không phụ thuộc live provider smoke test.
- `M9.33` phụ thuộc durable jobs/BullMQ `M4.3`, Admin panel `M9.8` và các
  pipeline lesson generation/figure hiện có. Socket.IO/Redis Pub/Sub chỉ báo
  invalidation; REST snapshot và fallback polling giữ tính hội tụ, không phụ
  thuộc notification realtime `M10.3` và không cần migration/outbox ở v1.
- `M9.21` phụ thuộc Quiz figure `M9.3`, panel/action frame `M9.8`, route ảnh
  `M9.20`, R2 và TeX renderer; thêm một paid multimodal call chỉ khi admin bấm
  `Tinh chỉnh`, giữ current revision cho tới khi candidate pass toàn bộ gate.
- `M9.22` phụ thuộc `M9.3`, `M9.8`, `M9.20`, `M9.21`; dùng lại figure/revision/job
  hiện có để author QUESTION/EXTEND/REDRAW từ header, trong đó REDRAW không phụ
  thuộc hình đề.
- `M9.23` phụ thuộc `M9.2`, `M9.3`, `M9.8`; dùng lại compile/validator endpoint
  của từng domain sau deterministic transform, không thêm provider call hoặc
  cache invalidation.
- `M9.24` phụ thuộc `M9.3`, `M9.8`, `M9.9-M9.12`, `M9.20`; dùng route
  `(QUIZ, TEXT)`, job/usage/budget hiện có và không đổi schema database.
- `M9.25` phụ thuộc `M9.23` cùng code editor/compile endpoint của `M9.2`, `M9.3`;
  chỉ mở rộng parser/transformer/UI ở web, không thêm backend/provider/cache.
- `M9.26` phụ thuộc `M9.23`, `M9.25` và named coordinate trong source TikZ;
  web tự nối đúng cạnh còn thiếu, tạo angle/midpoint/equal-length marker
  deterministic rồi dùng lại compile/history hiện có, không thêm backend/
  provider/cache.
- `M9.27` phụ thuộc Summary Phase 2 `M9.2`, modal `M9.8`, route ảnh `M9.20` và
  invariant hình lời giải độc lập của `M9.3/ADR-0024`; chỉ adapter invariant sang
  runtime Summary độc lập, không tạo dependency code từ Summary sang Quiz.
- `M9.4` và `M9.5` là `UI + API`: mỗi task phải kết thúc bằng flow học sinh bấm
  kiểm thử được, không tách UI sang `M9.8` hoặc một task chưa xác định.
- `M9.6` AI chat chỉ nên hoàn thiện sau `M4.4`, `M5.2`, `M5.3`, `M9.1` và đi
  sau `M9.5` để nhận context từ `Chat thêm với AI`.
- `M9.34` đi sau shared Chat runtime `M9.6` và dùng lại provider operations
  `M9.9-M9.12` cùng target context `M9.32`. Admin chỉ thêm auth/selected-scope
  adapter, session configuration và turn inspector; prompt/retrieval/streaming/
  safety/provider/accounting phải là cùng implementation với Student Chat.
- `M13.5` admin dashboard có thể dùng placeholder cho metric chưa có API, nhưng phải ghi rõ.
- `M3.6` cần enrollment thật từ `M8.3` và worker foundation `M4.3`; không được kích hoạt clone trước khi job hoàn tất.
- `M3.7` cần `M3.6`; `M7.8` cần `M3.6`, `M7.1`, `M7.5`; `M11.5` cần `M7.8`, `M11.1`, `M11.2`.
- `M3.8` cần lesson API/UI từ `M3.2`, `M3.4`; kết nối caption YouTube là best-effort và không phải dependency của video playback.
- `M15.1-M15.3` được ưu tiên sau khi student lesson/quiz/test/completion ở `M7.1-M7.5` sẵn sàng; `M15.2` cần thêm notes `M7.6`.
- `M15.4-M15.6` không được chạy trước nền transcript `M3.8`, retrieval `M5.x` và AI `M9.x` tương ứng.
- `M15.7` chỉ suy luận difficulty từ nhiều tín hiệu học tập; `M15.8` chỉ hiển thị analytics tổng hợp có ngưỡng riêng tư.
- `M9.7` độc lập với tracking/student surface `M15.1-M15.8`; task dùng saved
  transcript toàn video, exact preview draft và text-only worker, không tái sử
  dụng private Lesson Summary core.
- `M15.10` đi sau `M9.7`, `M6.5`, `M7.1`; chỉ giao bản Video Summary đã phát hành
  qua student lesson aggregate và sub-tab Video; chế độ xem từng phần dùng trực
  tiếp playback time và `startSeconds` đã có, không phụ thuộc tracking `M15.1`.
- M15 không thay đổi rule completed của `M7.5`; watched percent/chapter mastery chỉ là tín hiệu hỗ trợ.
- `M14.8` phụ thuộc các screen/query đã được implement ở từng feature; phần
  regression Playwright dùng nền `M14.3`, không chặn feature chưa có UI.

## 4. Khi nào cập nhật file này

Cập nhật khi thêm/xóa/hoãn task, đổi thứ tự milestone hoặc phát hiện dependency mới trong lúc code.
