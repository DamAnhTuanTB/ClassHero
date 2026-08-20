# Codex Execution Plan

Ngày: 2026-07-07

Update note 2026-07-07:

- File này là baseline execution plan được tạo ở bước `M0.P`.
- Roadmap hiện tại đã được bổ sung `Mode` và các task UI còn thiếu trong `docs/09-implementation-plan.md` + `docs/implementation/M*.md`.
- Khi chọn task tiếp theo, ưu tiên đọc `docs/09-implementation-plan.md` và file milestone tương ứng thay vì dùng danh sách task cũ trong file này.
- Danh sách task trong mục 3 là snapshot lịch sử và có thể thiếu task UI mới;
  không dùng mục đó làm roadmap hiện hành.

Update note 2026-07-26:

- Owner đã duyệt scope mở rộng `M15 Smart video learning`; chi tiết nằm ở `docs/implementation/M15.md`.
- Ưu tiên phần nền `M15.1-M15.3` sau khi hoàn tất core student `M7.1-M7.5`; các phần AI `M15.4-M15.8` chỉ chạy khi dependency `M3.8`, `M5.x`, `M9.x` tương ứng đã sẵn sàng.
- Mục 3 bên dưới tiếp tục là snapshot lịch sử. Thứ tự hiện hành chỉ lấy từ `docs/09-implementation-plan.md`.

Update note 2026-08-03:

- Riêng cụm AI được đồng bộ lại theo thứ tự
  `M9.1 -> M9.2 -> M9.3 -> M9.8 -> M9.16 -> M9.4 -> M9.5 -> M9.6 -> M9.7`.
- `M9.4` và `M9.5` là `UI + API`; `M9.8` chỉ là panel quản trị cho
  `M9.2-M9.3`, không thay thế UI học sinh.
- `M9.13-M9.15` là chuỗi corrective Done ngày 2026-08-11: admin sửa/xóa
  label-marker-caption, thêm dấu bằng nhau từ nhiều segment có tên và reset riêng
  một hình trong draft; dùng PUT hiện có, phụ thuộc `M9.2/M9.8` nhưng không chặn
  `M9.4`.
- `M9.16` Planned ngày 2026-08-11 tại
  `.codex/plans/m9-16-lesson-summary-prompt-contract-hardening-plan.md`: loại
  contract lặp, giữ prompt hiệu lực do admin sửa theo cơ chế thay thế nguyên văn,
  chống preview stale và mở learner profile/GT–KL/diagram grade tới lớp 12. Task
  này phải xong trước `M9.4`.
- Plan hardening M9.3 được đồng bộ ngày 2026-08-11 tại
  `.codex/plans/m9-3-ai-quiz-generation-completion-plan.md`; các subtask lõi
  M9.3/M9.8/M7.2/M7.4 vẫn giữ trạng thái `Done`.
- Corrective implementation M9.3 chốt Quiz output là danh sách EXAMPLE M9.2 cộng
  assessment metadata. Worker append vào `targetQuizSetId` đang mở, không tạo tab
  mới; lineage/audit theo question giữ đúng case 10→8. Admin/student dùng chung
  EXAMPLE schema/prompt/recovery/compiler/renderer/editor với Sinh kiến thức;
  Quiz không trả hoặc lưu sourceChunkIds ở cấp câu.

Update note 2026-08-12:

- Owner thay hướng M9.2 trên nhánh `codex/m9-texlive-tikz`: loại runtime/schema/
  test renderer JSON cũ và thay bằng OpenAI sinh source TeX/TikZ → TeX Live
  sandbox → SVG validator local → R2. Figure pass cả compiler và validator tự
  `SUCCEEDED`, không có bước approve bắt buộc. Nhánh cũ giữ nguyên hệ thống cũ
  tại commit đã chốt.
- Phạm vi hiện tại chỉ có figure cho Lesson Summary/Sinh kiến thức; Quiz,
  Flashcard, Test, Explanation và Chat giữ text-only.
- Hình light-only, Stage 2 nhận ảnh tham chiếu đã resolve nhưng không có Vision
  hậu kiểm tự động, hỗ trợ lớp 3–12. Mỗi compiler attempt gom toàn
  bộ lỗi đã phát hiện thành một diagnostic batch; mỗi auto/manual repair gửi
  source + cả batch trong một OpenAI request, không gửi riêng từng lỗi. Automatic
  AI repair tối đa 2 lượt và chỉ dành cho compiler failure; validator failure
  chuyển `NEEDS_REVIEW`; source policy/provider/timeout/network/storage/hạ tầng
  không tự retry và giữ trạng thái tương ứng để admin xử lý thủ công.
- Mọi request OpenAI lấy môn từ `learning_path.domain`, ghép lõi trung tính với
  đúng một profile `MATH|PHYSICS|CHEMISTRY|GENERAL`; snapshot môn nằm trong job/
  figure. Theo ADR-0015, source policy đích reject mọi compiler declaration và
  root environment không thuộc profile; backend tự nạp package/library đúng môn.
- Coverage hình dùng hai tầng: subject profile ép mức tối thiểu đã biết và AI vẫn
  phải chủ động trả thêm figure khi nội dung ngoài danh sách cần hình. Thiếu hình
  được lưu cùng Summary và gắn warning đúng block, không fail toàn generation và
  không chặn Lưu/Phát hành. Chỉ kế thừa rule coverage, không đưa `diagramSpec`/
  renderer JSON cũ sang nhánh này.
- Các mục M9.13–M9.16/coverage diagram JSON dưới đây chỉ là snapshot lịch sử của
  nhánh cũ, không còn là dependency hoặc task hiện hành trên nhánh TeX/TikZ.
- Kế hoạch lifecycle figure hiện dùng source editor + preview SVG. Phần editor
  PDF/SyncTeX đã bị owner loại khỏi phạm vi; ADR-0015 là contract hiện hành.

Update note 2026-08-13:

- Corrective M9.2 tiếp theo được lập tại
  `.codex/plans/m9-2-raw-source-context-and-figure-prompt-hardening-plan.md`.
- Provider Summary chỉ nhận OCR `content` nguyên chunk + metadata khách quan;
  không nhận source topic/candidate/hint do backend suy luận và không chia thêm
  source block. Output dùng source evidence (`HEADING` hoặc `CONTENT`) + chunk IDs
  để backend hậu kiểm mà không ép tài liệu phi cấu trúc phải có heading giả.
- Prompt bỏ dependency metadata cũ, compact figure rules và loại global
  `ALL_REQUIRED` suy từ title/OCR khỏi provider path. Đây vẫn là M9.2, chưa tạo
  task code mới và chưa triển khai production.

Update note 2026-08-17:

- Owner khôi phục invariant trình bày ý con cho Summary: trong mọi `problem`,
  `solution`, `answer`, mỗi nhãn `a)`, `b)`, `c)` hoặc nhãn chữ cái tương đương
  phải bắt đầu ở dòng riêng; không được dồn hai ý con trên cùng dòng.
- Đây vẫn là corrective của `M9.2`, áp dụng cho mọi loại example và subject
  profile. Bước implementation phải đồng bộ system prompt, description của cả ba
  field provider-facing và focused test; không thêm task code hay dependency mới.

Update note 2026-08-19:

- Owner chốt hard cutover M9.2 xóa hoàn toàn `visualIntent`, không legacy reader,
  dual contract hoặc fallback. Contract đích duy nhất là figure plan v3.
- Stage 2 có ảnh dùng ảnh + source target + projection block; không ảnh dùng
  projection block. Example không gửi solution/answer/conclusions.
- Implementation và migration một chiều đã hoàn tất ở source; deploy cần chạy
  migration, cập nhật API/web/worker atomically và restart worker. Kế hoạch chi tiết tại
  `.codex/plans/m9-2-remove-visual-intent-hard-cutover-plan.md`.
- Owner bổ sung `M9.17` Implemented: modal Sinh kiến thức có checkbox dùng trực tiếp
  crop ảnh gốc SGK. Phase 1 giữ nguyên; mode bật promote toàn bộ OCR crop
  thuộc tập khớp chắc chắn thành các figure cùng block và tuyệt đối không
  enqueue/call Phase 2. Candidate mơ hồ, thiếu crop hoặc full-page fallback cần
  admin review; figure `GENERATED_FROM_BRIEF` bị bỏ
  qua. `M9.17` phụ thuộc `M9.2`, `M9.8`, `M4.4` và dùng mã mới vì `M9.13-M9.16`
  đã thuộc lịch sử renderer JSON cũ.

## 1. Phạm vi bước này

Subtask hiện tại: `M0.P` - đọc tài liệu và tạo execution plan.

Đã đọc:

- `AGENTS.md`
- `docs/01-product-scope.md`
- `docs/03-technical-architecture.md`
- `docs/04-database-model.md`
- `docs/05-api-contract.md`
- `docs/06-ai-rag-spec.md`
- `docs/09-implementation-plan.md`

Không thực hiện trong bước này:

- Không sửa code production.
- Không tạo app/module/schema/migration.
- Không đổi stack công nghệ.
- Không thêm tính năng ngoài MVP.

## 2. Kiến trúc repo cần tạo

Repo nên dùng monorepo Turborepo theo cấu trúc đã chốt:

```txt
.
├── AGENTS.md
├── docs/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── tests/
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── modules/
│       │   ├── common/
│       │   ├── config/
│       │   ├── jobs/
│       │   └── workers/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── test/
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   ├── schemas/
│       │   └── constants/
├── docker-compose.yml
├── docker-compose.prod.yml
├── package.json
└── turbo.json
```

Ứng dụng chính:

- `apps/web`: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, React Hook Form, Zod, Tiptap, KaTeX/mhchem.
- `apps/api`: NestJS REST API, Swagger/OpenAPI, JWT access/refresh token, RBAC, Prisma, Socket.IO gateway, BullMQ integration.
- `apps/api` worker entrypoint: cùng codebase NestJS nhưng chạy bằng command/container riêng cho worker.
- `packages/shared`: shared types, Zod schemas, constants dùng chung cho web/API.

Hạ tầng production theo tài liệu:

- VPS chạy frontend container, backend API container, backend worker container, Redis, Nginx, Certbot.
- Supabase Postgres + pgvector là database production.
- Cloudflare R2 là storage upload chính.
- Redis + BullMQ dùng cho queue.
- OpenAI là AI provider chính; Gemini là provider phụ qua `AiProvider` abstraction.
- payOS cho payment, Resend cho email, Zalo OA/ZNS cho thông báo ngoài hệ thống.
- Socket.IO chỉ dùng notification realtime trong MVP, không làm chat realtime user-user.

## 3. Thứ tự thực hiện subtask đề xuất

Thứ tự dưới đây bám theo `docs/09-implementation-plan.md`, ưu tiên nền tảng trước tính năng sau:

1. `M0.P` - Đọc tài liệu và tạo execution plan.
2. `M0.1` - Khởi tạo monorepo Turborepo.
3. `M0.2` - Tooling, env example, Docker local, health check.
4. `M1.1` - Setup Prisma và database foundation.
5. `M1.2` - User, auth token, profile, file và background job models.
6. `M1.3` - Learning path, chapter, lesson, material, document và enrollment models.
7. `M1.4` - Quiz, flashcard, test, attempt và learning interaction models.
8. `M1.5` - Payment, notification, report, AI log, gamification và news models.
9. `M1.6` - Seed tối thiểu và database validation.
10. `M2.1` - Backend foundation module.
11. `M2.2` - Register, login, refresh và logout.
12. `M2.3` - RBAC, `GET /me`, profile base và forgot/reset password.
13. `M3.1` - Admin learning path API.
14. `M3.2` - Admin chapter và lesson API.
15. `M3.3` - Public/student learning path listing.
16. `M3.4` - Admin learning path/chapter/lesson UI cơ bản.
17. `M4.1` - FilesModule và R2 service.
18. `M4.2` - Lesson document API.
19. `M4.3` - BullMQ worker foundation.
20. `M4.4` - Paid OCR artifact và chunking.
21. `M6.1` - Rich text JSON và shared content schema.
22. `M6.2` - Quiz CRUD API và admin UI tối thiểu.
23. `M6.3` - Flashcard CRUD API và admin UI tối thiểu.
24. `M6.4` - Test CRUD API và admin UI tối thiểu.
25. `M6.5` - Student read-only lesson content API.
26. `M7.1` - Access check, trial lesson và lesson page skeleton.
27. `M7.2` - Quiz attempt và submit.
28. `M7.3` - Flashcard progress, favorite và review.
29. `M7.4` - Test start, submit và review.
30. `M7.5` - Best attempt, lesson completion và top 5.
31. `M7.6` - Personal notes và private comments dưới video.
32. `M8.1` - Discount code admin và validation.
33. `M8.2` - Create payment order bằng payOS.
34. `M8.3` - payOS webhook verify, idempotency và enrollment 12 tháng.
35. `M8.4` - Payment UI/status và thông báo sau thanh toán.
36. `M5.1` - AiProvider abstraction cho embedding.
37. `M5.2` - Embedding worker và lưu pgvector.
38. `M5.3` - RetrievalService vector search theo lesson.
39. `M5.4` - Hybrid search cho công thức/ký hiệu.
40. `M9.1` - AiModule structured output foundation.
41. `M9.2` - Admin generate lesson summary.
    41.1. Structural hardening done trên nhánh
    `codex/m9-2-summary-contract-v2`: khóa đúng một section cuối `Bài tập vận
dụng`, đúng hai bài lấy từ source; theory-example đi theo unit liền trước/sau;
    prompt/schema ngăn nhúng ví dụ vào theory và không trộn lesson `Luyện tập
chung`/`Bài tập cuối chương`. Output hợp lệ kỹ thuật luôn được lưu
    `NEEDS_REVIEW`; semantic/reference/presentation issues chỉ thành warning cho
    admin, không gọi model repair lần hai.
    41.2. Baseline chức năng M9.2 đã ổn theo xác nhận owner; snapshot hiện hành
    dùng prompt `lesson-summary-prompt-v60`, schema
    `lesson-summary-schema-v44`, source hash có `targetGrade`, authoring theo lớp,
    `geometryStatement` GT–KL cho bài chứng minh lớp 7–9, chuẩn hóa ký hiệu góc và
    recovery `VALID | AUTO_FIXED | REVIEWABLE | UNRENDERABLE` với policy
    `ACCEPT_OR_FIX | FIX_ONLY`. Note không còn bị ép phải có ví dụ; note tham chiếu
    hình/ảnh/URL nguồn được giữ nguyên và gắn review issue riêng cho admin.
    41.3. Nhánh hiện tại dùng TeX/TikZ cho Summary theo update note 2026-08-12;
    coverage cũ Toán 3–9/diagram compiler không áp dụng. Coverage mới trải lớp
    3–12 và package theo môn, dùng fixture/compile local mặc định; live provider
    luôn opt-in theo cost guard.
    41.4. Owner chốt ADR-0015 ngày 2026-08-13: lượt chuyên vẽ chỉ trả LaTeX
    figure snippet gồm optional local header trong toolbox allowlist rồi đúng một
    drawing root. Backend sở hữu document wrapper/package/compiler preamble và
    phạm vi toolbox. Không có compatibility path cho standalone source cũ.
    Implementation đã hoàn tất trong M9.2: shared schema/prompt/policy/
    renderer/editor cùng dùng snippet-only contract; không có compatibility path
    cho standalone source cũ, PDF/SyncTeX edit-session hay route approval cũ.
    41.5. Corrective M9.2 theo quyết định owner ngày 2026-08-17: trong modal
    `Tạo mới bằng AI`, ảnh tham chiếu và `adminInstructions` là hai authority duy
    nhất, ngang hàng theo phạm vi. Ảnh khóa baseline, field khóa delta; mọi phần
    ảnh ngoài delta phải được giữ nguyên; block sở hữu chỉ dùng kiểm chứng phần
    ảnh không quyết định. Đã sửa prompt Stage 2, serializer, parity preview/create, bảo toàn
    baseline + delta qua compiler repair và thêm regression/counterexample cho
    cả ba mode. Field rỗng/blank bị loại khỏi provider JSON và prompt mặc định.
    Stage 2 chỉ gửi projection của đúng block sở hữu figure; không suy
    hoặc gửi block lý thuyết đứng trước dưới field `pairedTheory`.
42. `M9.3` - Admin generate quiz/flashcard/test.
    42.1. Hardening plan mở rộng Quiz/Test solution/diagram và review tại
    `.codex/plans/m9-3-ai-quiz-generation-completion-plan.md`: output AI phải đủ
    initial count; sau đó admin được xóa câu và giữ số còn lại trong cùng
    set/generation. Question hợp lệ hiện ngay ở danh sách tab Quiz dưới trạng thái
    review; không tạo staging screen riêng. Đây không phải subtask roadmap mới.
43. `M9.8` - Admin AI generation panel UI. Done 2026-08-03.
    43.0.1. M9.13–M9.16 là lịch sử của nhánh renderer JSON cũ, không chạy trên
    nhánh TeX/TikZ.
    43.1. `M9.9` - Provider catalog, AI routing, Gemini fallback và usage accounting.
    43.2. `M4.6` - OCR accounting, retry-resume và budget guard.
    43.3. `M9.10` - Admin provider operations API.
    43.4. `M9.11` - Admin Cài đặt AI/OCR UI.
    43.5. `M9.12` - Hard-stop ngân sách tuyệt đối bằng reservation nguyên tử. Done 2026-08-03.
44. `M9.4` - Student request-new reserve-first UI + API.
45. `M9.5` - AI explanation cache inline UI + API.
46. `M9.6` - Chat AI trong lesson bằng RAG.
47. `M9.7` - Conversation summary và diagram placeholder.
48. `M10.1` - Notification in-app API.
49. `M10.2` - NotificationBell UI.
50. `M10.3` - Socket.IO realtime notification.
51. `M10.4` - Admin manual notification.
52. `M10.5` - Automatic notification triggers.
53. `M10.6` - Email/Zalo delivery workers.
54. `M11.1` - Parent-child link và selected child.
55. `M11.2` - Parent dashboard và progress view.
56. `M11.3` - Parent course list và payment for child.
57. `M11.4` - Parent notifications và news view.
58. `M12.1` - Student report item.
59. `M12.2` - Admin report moderation.
60. `M12.3` - AI unreviewed content moderation.
61. `M12.4` - News/events/livestream CRUD admin.
62. `M12.5` - Student/parent news/events view.
63. `M13.1` - XP events và level calculation.
64. `M13.2` - Global student leaderboard.
65. `M13.3` - Student profile editable fields.
66. `M13.4` - Avatar upload integration.
67. `M14.1` - Unit tests cho service quan trọng.
68. `M14.2` - API tests cho flow nhạy cảm.
69. `M14.3` - Playwright E2E cho flow chính.
70. `M14.4` - Security hardening và rate limit.
71. `M14.5` - Logging, monitoring và error tracking.
72. `M14.6` - Docker Compose production, Nginx và health checks.
73. `M14.7` - Backup/restore và vận hành production notes.
74. `M14.8` - Frontend loading, prefetch và transition hardening. `Done 2026-07-29`.

Ghi chú: `docs/09-implementation-plan.md` đặt nhóm `M8.x` trước `M5.x`/`M9.x` trong danh sách ưu tiên khi thiếu thời gian. Điều này hợp lý cho MVP có payment/enrollment trước AI nâng cao. Tuy nhiên, mọi subtask AI/RAG dựa trên tài liệu vẫn cần các phần `M4.x` và `M5.x` tương ứng trước khi hoàn thiện.

## 4. Phụ thuộc giữa các subtask

Phụ thuộc nền:

- `M0.2` phụ thuộc `M0.1`.
- `M1.x` phụ thuộc `M0.1`; `M1.6` phụ thuộc các model cần seed trong `M1.2` đến `M1.5`.
- `M2.1` phụ thuộc `M0.2` và `M1.1`.
- `M2.2` phụ thuộc `M1.2` và `M2.1`.
- `M2.3` phụ thuộc `M2.2`.

Phụ thuộc learning path/content:

- `M3.1` phụ thuộc `M1.3`, `M2.3`.
- `M3.2` phụ thuộc `M3.1`.
- `M3.3` phụ thuộc `M3.1`, `M3.2`, `M2.3` nếu trả enrollment/trial state.
- `M3.4` phụ thuộc API `M3.1`, `M3.2` và nền web từ `M0.1`.

Phụ thuộc file/document/worker:

- `M4.1` phụ thuộc `M1.2`, `M2.3`.
- `M4.2` phụ thuộc `M1.3`, `M4.1`.
- `M4.3` phụ thuộc `M1.2` background job model và `M0.2` Redis/Docker local.
- `M4.4` phụ thuộc `M4.2`, `M4.3`.

Phụ thuộc quiz/flashcard/test thủ công:

- `M6.1` phụ thuộc `M0.1`, `M2.1`; nên làm sau khi shared package có nền.
- `M6.2`, `M6.3`, `M6.4` phụ thuộc `M1.4`, `M2.3`, `M3.2`, `M6.1`; quiz/flashcard/test chỉ gắn với lesson, không gắn với chapter.
- `M6.5` phụ thuộc `M6.2` đến `M6.4`, `M3.2`, `M2.3`.

Phụ thuộc student learning:

- `M7.1` phụ thuộc `M1.3`, `M2.3`, `M3.2`, `M6.5`.
- `M7.2` phụ thuộc `M6.2`, `M7.1`.
- `M7.3` phụ thuộc `M6.3`, `M7.1`.
- `M7.4` phụ thuộc `M6.4`, `M7.1`.
- `M7.5` phụ thuộc `M7.4`, `M1.3`, `M1.4`.
- `M7.6` phụ thuộc note/comment/file models trong `M1.4` hoặc `M1.5` theo schema thực tế, `M4.1` nếu có ảnh ghi chú.

Phụ thuộc payment:

- `M8.1` phụ thuộc `M1.5`, `M2.3`, `M3.1`.
- `M8.2` phụ thuộc `M8.1`, `M1.5`, `M2.3`.
- `M8.3` phụ thuộc `M8.2`, `M1.3` enrollment model, `M1.5` webhook log/payment models.
- `M8.4` phụ thuộc `M8.2`, `M8.3`; notification thật phụ thuộc `M10.1`, nếu chưa có thì dùng event/TODO placeholder.

Phụ thuộc AI/RAG:

- `M5.1` phụ thuộc `M1.2`, `M2.1`; dùng env/config từ nền API.
- `M5.2` phụ thuộc `M4.4`, `M5.1`, `M1.3`, `M4.3`.
- `M5.3` phụ thuộc `M5.2`.
- `M5.4` phụ thuộc `M5.3`.
- `M9.1` phụ thuộc `M5.1`, `M1.5`, `M4.3`.
- `M9.2` phụ thuộc `M5.3`, `M9.1`, `M1.3`.
- M9.2 TeX/TikZ chỉ nối figure vào Summary; M9.3 giữ text-only và không phụ thuộc
  capability figure hiện tại.
- `M9.3` phụ thuộc `M6.2` đến `M6.4`, `M5.3`, `M9.1`.
- `M9.8` phụ thuộc `M9.2`, `M9.3`, `M4.3`; xếp ngay sau `M9.3` để generation
  có UI quản trị kiểm thử trước khi chuyển sang student flow; đã Done
  2026-08-03.
- `M9.4` phụ thuộc `M9.3`, `M6.2` đến `M6.4`, `M7.1-M7.4`; task bao gồm nối
  action request-new trên UI học sinh, không chỉ endpoint/worker.
- `M9.5` phụ thuộc `M9.1`, `M5.3`, `M6.2` đến `M6.4`, `M7.2-M7.4`; task bao
  gồm inline explanation UI và trạng thái polling/error/retry.
- `M9.6` phụ thuộc `M5.4`, `M9.1`, `M7.1`; làm sau `M9.5` để nhận context từ
  `Chat thêm với AI`.
- `M9.7` phụ thuộc `M9.6`; diagram rendering thật phụ thuộc `M4.1` và queue/worker.

Phụ thuộc notification:

- `M10.1` phụ thuộc `M1.5`, `M2.3`.
- `M10.2` phụ thuộc `M10.1` và nền web.
- `M10.3` phụ thuộc `M10.1`, `M2.3`.
- `M10.4` phụ thuộc `M10.1`, `M10.2`, `M2.3`.
- `M10.5` phụ thuộc các flow phát event như `M7.5`, `M8.3`, `M10.1`.
- `M10.6` phụ thuộc `M10.1`, `M4.3`, env provider.

Phụ thuộc parent/report/news/gamification/testing:

- `M11.1` phụ thuộc `M1.2`, `M2.3`.
- `M11.2` phụ thuộc `M11.1`, `M7.5`.
- `M11.3` phụ thuộc `M11.1`, `M8.2`, `M8.3`.
- `M11.4` phụ thuộc `M10.1`; phần news phụ thuộc `M12.5`.
- `M12.1` phụ thuộc `M6.2` đến `M6.4`, `M7.1`, `M1.5`.
- `M12.2` phụ thuộc `M12.1`, `M2.3`.
- `M12.3` phụ thuộc `M9.3`, `M9.4`.
- `M12.4` phụ thuộc `M1.5`, `M2.3`, `M6.1` nếu dùng rich text.
- `M12.5` phụ thuộc `M12.4`.
- `M13.1` phụ thuộc `M7.5`, `M1.5`.
- `M13.2` phụ thuộc `M13.1`.
- `M13.3` phụ thuộc `M2.3`, `M1.2`.
- `M13.4` phụ thuộc `M4.1`, `M13.3`.
- `M14.1` đến `M14.5` phụ thuộc các service/flow tương ứng đã được implement.
- `M14.6` phụ thuộc `M0.2` và app/container đã tồn tại.
- `M14.7` phụ thuộc quyết định deploy/env từ `M14.6`.
- `M14.8` phụ thuộc các screen/query tương ứng đã được implement; phần E2E mở
  rộng dùng nền `M14.3` và triển khai theo batch Admin/Student có checkpoint.

## 5. Kiểm tra mâu thuẫn tài liệu

Không phát hiện mâu thuẫn lớn làm thay đổi stack, scope MVP hoặc kiến trúc chính.

Các điểm cần ghi chú khi triển khai:

- Domain production trong `AGENTS.md` dùng placeholder `yourdomain.com`, còn `docs/03-technical-architecture.md` ghi ví dụ `hocai.vn` và `api.hocai.vn`. Quyết định tạm thời: coi domain là cấu hình deploy/env, chưa hard-code domain trong code.
- `docs/09-implementation-plan.md` có thứ tự ưu tiên MVP đặt `M8.x` trước `M5.x`/`M9.x`. Quyết định tạm thời: giữ thứ tự này cho bản chạy thanh toán/học thủ công, nhưng khi làm AI/RAG phải tuân thủ dependency `M4.x -> M5.x -> M9.x`.
- Một số nội dung được đánh dấu `ASSUMPTION` hoặc `TODO` trong tài liệu, ví dụ dung lượng upload final, parent avatar, OCR PDF scan, XP formula, Zalo credential/mock, email/Zalo anti-spam. Quyết định tạm thời: không tự chốt thành rule cố định; khi đến subtask liên quan thì ghi rõ assumption hoặc hỏi owner.
- `docs/05-api-contract.md` cho phép chat AI xử lý sync ở MVP nếu latency chấp nhận được, trong khi generation nặng phải async. Điều này không mâu thuẫn với worker architecture; khi implement cần quyết định theo subtask `M9.6` và ghi rõ nếu chuyển chat sang async.

## 6. Lệnh kiểm tra đã chạy

- `pwd`
- `rg --files`
- `git status --short` - ghi chú lịch sử lúc tạo baseline; repo hiện tại đã là Git repo, luôn chạy lại `git status --short` khi bắt đầu task mới.
- `wc -l` các tài liệu được yêu cầu.
- `sed` đọc các tài liệu được yêu cầu.
- `date +%Y-%m-%d`

Không chạy test/build vì bước này chỉ tạo tài liệu kế hoạch, chưa có code production.
