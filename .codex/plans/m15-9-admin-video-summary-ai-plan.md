# Kế hoạch M9.7 — Admin tạo bản tóm tắt toàn video bằng AI

Ngày lập: 2026-09-10

Trạng thái: **Đã triển khai 2026-09-10; đã chạy live provider smoke test có kiểm
soát và tiếp tục tinh chỉnh contract khối theo phản hồi owner.**

Trạng thái task canonical: **Done (`M9.7`)**.

Tên file giữ mã lịch sử `m15-9` để không làm hỏng liên kết từ các phiên trước.

## 1. Mục tiêu

Tại màn `/admin/lessons/[lessonId]`, panel `Tạo nội dung bằng AI` có card
`Video` đứng trước card `Kiến thức`. Card chỉ hoạt động khi lesson có
video và transcript đã lưu có ít nhất một cue hợp lệ. Modal dùng
chapter/mốc thời gian tùy chọn cùng toàn bộ
transcript đã chuẩn hóa để tạo một bản tóm tắt ngắn gọn bằng AI.

Output cần:

- Mở đầu bằng khối tổng quan ngắn các kiến thức chính sẽ học, tương tự mục tiêu
  bài học trong luồng Sinh kiến thức.
- Trả các khối Kiến thức/Ví dụ đúng thứ tự xuất hiện trong video và giải thích
  ngắn mỗi phần nói về điều gì; không bịa khối Ví dụ khi nguồn không có ví dụ.
- Nếu chapter thật đã được cấu hình, mỗi chapter bắt buộc ánh xạ một-một sang
  section cùng thứ tự/title/time; chỉ khi chưa có chapter AI mới tự chia section
  và backend ghi ngược các section thành mốc thời gian video sau khi persist.
- Trình bày heading, đoạn văn, danh sách và xuống dòng mạch lạc.
- Giữ công thức Toán/Lý/Hóa ở LaTeX canonical tương thích KaTeX/mhchem.

## 2. Quyết định phạm vi

- Đây là subtask `M9.7`, thuộc nhóm AI generation và dùng nguồn video/transcript;
  phạm vi đã
  được owner chấp thuận.
- Mode: `Database + API + worker + admin UI + AI contract`.
- Video Summary là resource độc lập, không ghi đè:
  - `lessons.overview_content_json` là Tổng quan buổi học rich text;
  - `lessons.short_description` là mô tả ngắn nhập thủ công;
  - `lesson_summaries` là bản Sinh kiến thức từ PDF.
- Task đầu chỉ phục vụ admin tạo, xem, sửa và duyệt. Chưa thêm student surface.
- Chapter/mốc thời gian là optional; video và saved transcript là bắt buộc.
- Không sinh hình/TikZ, không gọi Phase 2 và không gửi PDF/document chunks.

## 3. Luồng hoàn chỉnh

```txt
Lesson detail
  -> kiểm tra video + saved transcript
  -> card Video trong panel AI -> mở modal Tóm tắt Video bằng AI
  -> chỉnh style/length/model/instructions
  -> Xem dữ liệu
      -> backend resolve video/cut settings/chapters/transcript
      -> normalize + source hashes + exact request draft
      -> token/cost estimate, không gọi provider
  -> Tạo tóm tắt video
      -> verify draft/hash/source/config
      -> reserve budget + enqueue idempotent job
      -> worker gọi VIDEO_SUMMARY/TEXT
      -> validate schema + semantic invariants
      -> persist NEEDS_REVIEW atomically
  -> UI poll/resume job
  -> render và chỉnh sửa kết quả trong tab Video
  -> admin sửa/duyệt/sinh lại/xóa
```

Nếu video URL, transcript, chapter hoặc cấu hình cắt thay đổi, backend đặt bản
hiện hành thành stale. Candidate lỗi không được ghi đè bản hợp lệ trước đó.

## 4. Database và shared contract

### 4.1. Prisma/migration

Thêm:

- `lesson_video_summaries`: một active record/lesson, `contentJson`, source,
  review status, generation provenance, bốn source hash và `staleAt`.
- `lesson_video_summary_request_drafts`: exact prompt/request/source snapshot,
  schema + route snapshot, token/cost estimate, TTL và consumed state.
- `AiGenerationType.VIDEO_SUMMARY`.
- Provider usage operation/target context riêng cho `VIDEO_SUMMARY_GENERATION`
  và `LESSON_VIDEO_SUMMARY`.
- `ai_feature_model_configs` pair `VIDEO_SUMMARY/TEXT`; migration clone giá trị
  khởi tạo từ `SUMMARY/TEXT`, sau đó hai route độc lập.

Không tạo `VIDEO_SUMMARY/IMAGE`.

### 4.2. Output schema

Structured output schema version 8, ánh xạ trực tiếp sang document
`lesson_summary_blocks` version 6 để dùng đúng renderer của Sinh kiến thức:

```txt
title
objectives[]
sections[]
  order
  displayHeading
  startSeconds
  blocks[]
    knowledge: title, content, startSeconds
    example: problem, solution, answer, startSeconds
```

`objectives` luôn được renderer đặt ở đầu với nhãn `Các kiến thức trong bài giảng`, đúng
một ý chính cho mỗi section. Các
`knowledge`/`example` giữ đúng mạch thời gian video và dùng nguyên màu sắc, bố
cục, typography, công thức cùng quy tắc nội dung của khối Sinh kiến thức. Mỗi
`example` bắt buộc đủ đề bài, lời giải và kết luận. Video Summary không có khối
`summary` riêng.
`startSeconds` của block phải tăng dần và khớp chính xác một cue transcript thật.
Khi có chapter, `section.startSeconds` dùng chính xác time của chapter; khi không
có chapter mới dùng cue sớm nhất của section. AI không được tự bịa mốc hay ví dụ.
Example phụ thuộc visual
không thể tự đủ dữ kiện bằng text phải bị loại.

## 5. Backend/API

Tạo domain boundary Video Summary riêng; controller chỉ xử lý HTTP, service sở
hữu authorization/readiness/source normalization/draft/persistence, worker sở hữu
provider execution. Không import private `lesson-summary-*` prompt/schema/mapper.

API admin:

- `GET /admin/lessons/:lessonId/video-summary`
- `POST /admin/lessons/:lessonId/video-summary/prompt-preview`
- `POST /admin/lessons/:lessonId/video-summary/generate-ai`
- `PUT /admin/lessons/:lessonId/video-summary`
- `DELETE /admin/lessons/:lessonId/video-summary`

Quy tắc:

- Client chỉ gửi generation config; backend tự lấy raw source theo `lessonId`.
- Preview trả exact system prompt, user prompt, normalized source packet, request
  JSON, schema, token/cost estimate, `requestDraftId` và `requestHash`.
- Generate bắt buộc draft fresh/chưa consume và source/config còn khớp.
- Error code chính: `VIDEO_SUMMARY_SOURCE_NOT_READY`,
  `VIDEO_SUMMARY_SOURCE_CHANGED`, `VIDEO_SUMMARY_INPUT_TOO_LARGE`.
- Job/usage/budget/target context dùng nền M4.3 và M9; reload không tạo job mới.

Module/file dự kiến:

```txt
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/<timestamp>_add_lesson_video_summary/
apps/api/src/modules/video-summaries/
  video-summaries.module.ts
  controllers/admin-video-summaries.controller.ts
  dto/
  services/
  selectors/
  serializers/
  types/
  utils/
apps/api/src/workers/services/video-summary-generation.service.ts
packages/shared/src/schemas/video-summary*.ts
packages/shared/src/types/provider-usage*.ts
```

Tên file shared cuối cùng phải bám file owner hiện có, không tạo barrel chỉ để
re-export.

## 6. AI contract

- Sở hữu system prompt hoàn chỉnh theo `MATH`, `PHYSICS`, `CHEMISTRY`, `GENERAL`.
- Static prompt/schema nằm trước cache breakpoint; transcript/chapter và yêu cầu
  admin nằm sau breakpoint.
- Invariant bắt buộc: chỉ dùng nguồn lesson hiện tại; objectives đúng một ý cho
  mỗi section ở đầu;
  knowledge/example đúng thứ tự và cùng contract Sinh kiến thức; chapter ánh xạ
  hai chiều với section; không
  bịa nội dung/ví dụ/timestamp; formula syntax hợp lệ; không lặp ý.
- Schema/Zod kiểm shape và giới hạn count/length. Semantic validator kiểm section
  có căn cứ, timestamp nằm trong khoảng phát, outcome không vượt quá transcript.
- Preflight chặn khi input vượt `VIDEO_SUMMARY/TEXT.maxInputTokens`; không âm thầm
  cắt transcript hay phát sinh nhiều paid call ngoài estimate đã hiển thị.
- Version/hash gồm video URL, cut settings, transcript, chapter, prompt/schema và
  generation configuration.

## 7. Admin UI

Thay đổi chính:

- Giữ section `Tổng quan buổi học` và dữ liệu Tiptap trên lesson như một phạm vi
  độc lập.
- Panel AI có năm card theo thứ tự `Video`, `Kiến thức`, `Quiz`, `Flashcard`,
  `Test`; tab nội dung thêm `Video` ngay trước `Kiến thức`.
- Card `Video` disabled khi thiếu video hoặc thiếu saved transcript;
  hiển thị lý do bằng tooltip/helper, không chỉ bằng màu.
- Bỏ section accordion `Tổng quan video`; tab `Video` hiển thị trực tiếp ba
  chế độ UI/JSON/Song song và luồng chỉnh sửa khối giống `Kiến thức`.
  Tiến trình/lỗi job chỉ hiển thị trên card AI, không lặp banner trong tab.
- Modal lazy-load dùng `EditorDialogShell`, React Hook Form + Zod và shared form
  controls hiện có.
- Fields: style, length, target word count, additional instructions, model,
  Temperature hoặc Reasoning Effort theo capability, max output tokens.
- `Xem dữ liệu` có các tab system prompt, user prompt, dữ liệu nguồn và request;
  hiển thị chapter/timestamp/transcript, token và estimated cost.
- Form/source đổi làm preview stale; submit pending chống double-click; mở lại
  modal resume đúng job đang chạy.
- Trong tab `Video`, render Video Summary bằng chính `SummaryBlockRenderer`
  của Sinh kiến thức, có empty/needs-review/stale/success state và action
  sửa, phát hành/thu hồi, sinh lại, xóa; có Mục lục và timestamp tua video.
- Tab hiển thị trực tiếp `Chỉ xem UI | Chỉ xem JSON | Song song`, sửa
  khối Tiptap, xóa/di chuyển khối và sửa/xóa/di chuyển đề mục. Tất cả
  thay đổi là local draft cho tới khi admin bấm `Lưu nội dung`.
- Bổ sung nhóm `Tóm tắt Video` text-only tại `Admin -> Cài đặt AI`; không có tab
  Phase 2 ảnh.

File dự kiến:

```txt
apps/web/features/admin/lessons/api/admin-video-summary-api.ts
apps/web/features/admin/lessons/hooks/use-admin-video-summary.ts
apps/web/features/admin/lessons/schemas/admin-video-summary-schema.ts
apps/web/features/admin/lessons/types/admin-video-summary.types.ts
apps/web/features/admin/lessons/screens/admin-lesson-detail/components/
  admin-video-summary-generation-dialog.tsx
  admin-video-summary-content.tsx
apps/web/features/admin/lessons/screens/admin-lesson-detail/index.tsx
apps/web/features/admin/ai-settings/...  # thêm route VIDEO_SUMMARY/TEXT
```

Trong lúc implement phải giữ/merge các thay đổi đang tồn tại ở lesson detail,
không revert worktree của owner.

## 8. Thứ tự triển khai

1. Prisma enum/models/migration + shared schema/types.
2. Provider configuration `VIDEO_SUMMARY/TEXT`, seed clone và accounting target.
3. Source normalizer/hash + prompt preview/request draft API.
4. Job enqueue + worker prompt/schema/validator/persistence.
5. CRUD/review/stale API.
6. Web API/hooks/schema + modal generation.
7. Gating button + result block tại lesson overview + AI settings row.
8. Tests, typecheck, lint/build cần thiết và visual check đa viewport/theme.
9. Restart worker rồi mới chạy runtime smoke test.

## 9. Kiểm thử bắt buộc

- Unit: transcript/chapter normalization, cut-time mapping, stable hashes, source
  changed, input cap, formula mapper và semantic validator.
- Contract: đủ bốn subject; có/không có chapter; transcript rỗng; section lớn;
  inline/block LaTeX; phản ví dụ bịa timestamp/nội dung.
- API/integration: RBAC, preview không gọi provider, draft TTL/consume/idempotency,
  budget fail-closed, candidate failure giữ current, stale invalidation.
- Worker: correct route/operation/target context/usage, schema invalid, provider
  error và atomic promote.
- Web/Playwright: disabled reason, dirty transcript, modal preview states,
  double-submit, close/reopen resume, render rich text, review/stale actions trên
  mobile/tablet/desktop và light/dark.
- Commands tối thiểu: Prisma validate/migration status, focused tests,
  `pnpm --filter api typecheck`, `pnpm --filter web typecheck`, scoped lint,
  `git diff --check`; build nếu dependency graph/bundle boundary thay đổi.

Không gọi provider trả phí trong test mặc định. Live smoke test chỉ chạy khi
owner xác nhận ngân sách; phải báo trước model, số call và chi phí ước tính.

## 10. Acceptance gate

- Nút chỉ bật đúng khi có video + saved transcript; chapter optional.
- Preview và execute dùng đúng cùng request/source hash, không gọi AI ở preview.
- Nội dung đúng ba mục tiêu sản phẩm, trình bày mạch lạc và render đúng công thức.
- Output không làm mất `shortDescription` hoặc Lesson Summary hiện có.
- Source thay đổi tạo stale state; generation lỗi giữ nguyên bản hiện hành.
- Usage/budget/job/target context đầy đủ, không log raw transcript/prompt/output.
- Tất cả focused checks pass và worker đã được restart trước runtime verification.

## 11. ASSUMPTION/TODO

- ASSUMPTION: task đầu là admin-only; chưa trả Video Summary cho student.
- ASSUMPTION: transcript dùng để generate phải là bản đã lưu ở backend; nội dung
  đang chỉnh trong form không được gửi trực tiếp.
- Đã xác nhận `TiptapContentView` dùng trực tiếp được cho `contentJson` và đã có
  xử lý KaTeX; output được map về rich-text document chung.
