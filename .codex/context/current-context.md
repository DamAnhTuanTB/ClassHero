# Current Codex Context

Last updated: 2026-08-28

File này là snapshot định hướng nhanh, không phải nhật ký triển khai. Source of
truth vẫn là `AGENTS.md`, docs domain, milestone/ADR liên quan và code hiện tại.

## 1. Trạng thái hiện tại

Nhánh công việc hiện tại tập trung vào pipeline Lesson Summary `M9.2` và các
phần mở rộng quản trị hình STEM:

- Corrective M9.2 đã hard-cutover sang figure plan version 3 và xóa
  `visualIntent`; không giữ legacy reader, dual schema hoặc fallback.
- Stage 1 giữ provenance/source target; Stage 2 chỉ nhận projection của đúng
  block sở hữu figure. Backend không còn suy hoặc gửi `pairedTheory`.
- Phạm vi hình hiện áp dụng cho Lesson Summary và Quiz bằng hai pipeline độc lập.
  Flashcard, Test, Explanation và Chat vẫn chưa sinh figure.
- Quiz đã hard-cutover sang core riêng trong domain Quiz: schema/prompt/subject,
  context/job/worker/mapper, form cấu hình và renderer đều không dùng lõi Lesson
  Summary. Runtime chỉ đọc `quizExplanationBlock`, không có fallback dữ liệu cũ.
- Figure chỉ có light theme; dark UI đặt hình trên surface sáng.
- Worker/API/web của pipeline phải deploy cùng version và worker phải được
  restart sau khi code liên quan thay đổi.

Các subtask mới nhất:

- `M9.17`: Summary có thể dùng trực tiếp crop SGK đã resolve chắc chắn và bỏ qua
  toàn bộ Phase 2; candidate mơ hồ/full-page/thiếu crop giữ `NEEDS_REVIEW`.
  Checkbox phụ có thể tự làm nét bằng pipeline local M9.18 trước khi lưu.
- `M9.18`: editor raster local cho `TEXTBOOK_SOURCE` đã hoàn tất. UI lazy-load
  dùng Canvas/Pointer Events; API Sharp hỗ trợ preview read-only và apply thành
  immutable WebP lossless revision. Mask không persist, apply lỗi không thay
  current asset, không gọi provider và không thêm worker/job.
- `M9.19`: giới hạn input/output thuộc từng AI feature trong
  `Cài đặt AI -> Thiết lập mặc định`; catalog/model management không giữ hoặc
  hiển thị token limit. Route snapshot và budget reservation đọc feature config.
- `M9.20`: mỗi Summary/Quiz/Flashcard/Test có route `TEXT` và `IMAGE` độc lập.
  Summary/Quiz modal cho override từng phase; immutable draft/job giữ hai
  snapshot và figure worker ưu tiên route IMAGE. Flashcard/Test mới lưu cấu
  hình mặc định, chưa sinh hình.
- `M9.22`: header card Quiz có menu portal tạo hình đề, lời giải EXTEND hoặc
  REDRAW dùng lại modal preview/request/chi phí. EXTEND khóa exact hình đề AI;
  REDRAW không cần hoặc gửi hình/code hình đề.
- `M9.25`: shared `Chỉnh nhanh` parse và liệt kê từng nhãn/số đo an toàn thành
  input sửa/xóa độc lập, rồi dùng compile/validator hiện có; không đổi API/
  database/worker và không gọi provider.

## 2. Contract cần nhớ

- Prompt/heuristic/validator/policy AI phải dựa trên invariant tổng quát; không
  hard-code lesson, figure, số liệu hoặc hình cụ thể để vá regression.
- Trong modal tạo Summary, hai prompt hiển thị là prompt cuối gửi provider;
  backend/worker không được âm thầm nối thêm prompt nghiệp vụ.
- Khi Stage 2 có ảnh tham chiếu, ảnh là ground truth cho baseline; yêu cầu admin
  chỉ là delta có thẩm quyền trong phạm vi được nhập.
- Backend sở hữu compiler envelope, package/toolbox allowlist, source policy,
  validator và sandbox. Provider chỉ trả figure snippet theo contract.
- Chỉ promote delivery asset sau khi compile và validator đều pass; student chỉ
  tải current SVG/raster đã promote.
- Quick cleanup trong admin code editor phải sửa trực tiếp `latexSource` draft,
  tự chạy compile/validator để cập nhật preview và chỉ đổi current revision khi
  admin bấm `Áp dụng`. Không tạo asset variant, không gọi AI theo mỗi thao tác;
  transformer phải bảo toàn node chưa xác định chắc chắn đúng loại cần xóa.
- Test provider trả phí luôn opt-in. Trước forced/full run phải báo số request,
  ước tính chi phí và chờ owner xác nhận.

## 3. Verification gần nhất

- `M9.17`: API/web typecheck và scoped lint pass; backend regression 6/6; full
  API suite 436 pass/6 skip; Playwright checkbox desktop/mobile 2/2.
- `M9.18`: focused utility/service tests, scoped lint, API/web typecheck/build và
  Playwright desktop/mobile pass; visual-check dùng 6 crop Mathpix thật.
- `M9.19`: focused route/reservation/API/UI contract tests, migration
  deploy/status, Prisma validate và API/web typecheck/lint pass theo coverage
  matrix hiện tại.
- `M9.20`: Prisma validate, focused route/summary/quiz tests, scoped lint,
  API/web typecheck/build và worker boot pass; không gọi provider trả phí.
- `M9.22`: focused authoring/admin-action/REDRAW-worker tests, API/web
  typecheck/scoped lint, build, Prisma validate, worker boot và browser runtime
  pass. Live OpenAI smoke chạy đúng 1 request REDRAW: preview tối đa `381 VND`,
  usage thực tế `48 VND`, job/SVG đều `SUCCEEDED`.
- `M9.23`: web/API typecheck và scoped lint pass; 40 transform/browser tests,
  8 Summary/Quiz UI flow tests và 45 TeX Live compile pass. Live OpenAI chạy 4
  request Toán hình/Toán đại/Vật lý/Hóa học, tổng 15.291 input token (8.434 cache),
  6.087 output token, 36 transform compile pass, chi phí ước tính `240 VND`.
- `M9.25`: 60 focused source-action test, 4 responsive browser interaction,
  10 TeX Live local compile, web typecheck/scoped lint/build pass; không gọi paid
  provider.
- Verification M9.17-M9.19 dùng mock/local artifact, không gọi provider trả phí.

Chi tiết lịch sử live audit, chi phí và screenshot nằm trong `.codex/artifacts/`
và các plan M9; không lặp lại tại snapshot này.

## 4. Nguồn đọc tiếp

- Scope/Done: `docs/implementation/M9.md`.
- AI/RAG contract: `docs/06-ai-rag-spec.md`.
- API: `docs/api/learning-paths-lessons.md`,
  `docs/api/provider-operations.md`.
- Database: `docs/database/ai-rag-chat.md`,
  `docs/database/provider-operations.md`.
- Performance/observability: `docs/12-performance-and-observability.md`.
- Quyết định: `docs/decisions/ADR-0018-remove-visual-intent-hard-cutover.md`,
  `docs/decisions/ADR-0019-local-stem-figure-raster-cleanup.md`,
  `docs/decisions/ADR-0023-phase-specific-ai-model-routing.md`.
- Plan corrective chính:
  `.codex/plans/m9-2-remove-visual-intent-hard-cutover-plan.md`.

## 5. Lưu ý worktree

Worktree ngày 2026-08-20 đang có thay đổi chưa commit cho M9.18, M9.19 và các
docs/code liên quan. Phải đọc `git status --short` và diff thật trước khi làm task
tiếp theo; không revert hoặc ghi đè các thay đổi này.

## 6. Quy tắc cập nhật file này

Chỉ giữ hướng hiện tại, subtask đang hoạt động, blocker, check gần nhất và link
đến source of truth. Không thêm lịch sử từng lần thử, log dài, PID, transcript
debug hoặc diễn giải contract đã có ở docs domain/ADR/artifact.
