## 2026-07-07 — Codex execution plan

- Summary: Tạo execution plan cho bước `M0.P` sau khi đọc tài liệu cốt lõi của dự án.
- Changed:
  - Tóm tắt kiến trúc repo monorepo Turborepo cần tạo.
  - Ghi thứ tự thực hiện subtask, phụ thuộc giữa subtask và các điểm cần chú ý trong tài liệu.
- Files touched:
  - `.codex/plans/codex-execution-plan.md`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - Not run: bước này chỉ cập nhật tài liệu kế hoạch, không sửa code production.
- Notes:
  - `git status --short` không chạy được vì thư mục hiện tại chưa phải Git repo.
  - Không phát hiện mâu thuẫn lớn làm thay đổi stack, scope MVP hoặc kiến trúc chính.

## 2026-07-07 — Chuẩn hóa prompt library

- Summary: Rút gọn prompt trong `.codex/prompts` để Codex dễ tự xác định phạm vi, tài liệu cần đọc và bước hoàn tất.
- Changed:
  - Thay prompt lặp từng subtask bằng template chuẩn và catalog subtask ngắn.
  - Gộp các prompt đặc biệt thành bộ prompt ngắn cho bug, docs, API, DB, AI/RAG, UI, test, review và hotfix.
- Files touched:
  - `.codex/prompts/core-features.md`
  - `.codex/prompts/special-cases.md`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - Not run: thay đổi chỉ cập nhật prompt/tài liệu, không sửa code production.
- Notes:
  - Prompt khởi động hiện trỏ tới `.codex/plans/codex-execution-plan.md`, khớp với file execution plan hiện có trong repo.

## 2026-07-07 — Project-local task runner skill

- Summary: Chuyển skill `learning-task-runner` vào `.codex/skills` của dự án để chỉ áp dụng trong repo này.
- Changed:
  - Di chuyển skill khỏi thư mục Codex global.
  - Validate lại skill ở vị trí project-local.
- Files touched:
  - `.codex/skills/learning-task-runner/SKILL.md`
  - `.codex/skills/learning-task-runner/agents/openai.yaml`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/learning-task-runner`
- Notes:
  - Bản global `/Users/damanhtuan/.codex/skills/learning-task-runner` đã được gỡ khỏi vị trí toàn cục.

## 2026-07-07 — Suggest next subtask in task runner

- Summary: Cập nhật skill `learning-task-runner` để sau khi hoàn thành task luôn gợi ý mã subtask tiếp theo nên làm.
- Changed:
  - Thêm quy tắc chọn subtask tiếp theo dựa trên `.codex/plans/codex-execution-plan.md` hoặc `docs/09-implementation-plan.md`.
  - Yêu cầu final response có dòng gợi ý `/task <mã subtask>` kế tiếp.
  - Cập nhật metadata UI của skill cho đúng hành vi mới.
- Files touched:
  - `.codex/skills/learning-task-runner/SKILL.md`
  - `.codex/skills/learning-task-runner/agents/openai.yaml`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/learning-task-runner`
- Notes:
  - Skill vẫn nằm project-local trong `.codex/skills`, không dùng vị trí global.

## 2026-07-07 — Add technical summary to task runner

- Summary: Cập nhật skill `learning-task-runner` để sau mỗi task Codex mô tả ngắn gọn kỹ thuật đã dùng.
- Changed:
  - Thêm mục `Technical Summary` vào workflow kết thúc task.
  - Yêu cầu final response nêu front-end, back-end, database, worker/AI/integration nếu các phần đó có thay đổi.
  - Cập nhật metadata UI của skill cho đúng hành vi mới.
- Files touched:
  - `.codex/skills/learning-task-runner/SKILL.md`
  - `.codex/skills/learning-task-runner/agents/openai.yaml`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/learning-task-runner`
- Notes:
  - Skill chỉ yêu cầu mô tả các lớp kỹ thuật thực sự được chạm tới, không bịa thêm layer không thay đổi.

## 2026-07-07 — Explain technical flow in task runner

- Summary: Cập nhật skill `learning-task-runner` để phần mô tả kỹ thuật sau task giải thích luồng code/data flow thay vì chỉ liệt kê công nghệ.
- Changed:
  - Đổi `Technical Summary` thành `Technical Flow Summary`.
  - Yêu cầu mô tả các ranh giới/pattern như component -> hook -> API client, controller -> DTO/guard -> service -> Prisma, API -> queue -> worker -> DB.
  - Cập nhật metadata UI của skill cho đúng hành vi mới.
- Files touched:
  - `.codex/skills/learning-task-runner/SKILL.md`
  - `.codex/skills/learning-task-runner/agents/openai.yaml`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/learning-task-runner`
- Notes:
  - Skill vẫn yêu cầu chỉ mô tả các lớp kỹ thuật thực sự được chạm tới.

## 2026-07-07 — Maintain execution plan during task runner workflow

- Summary: Cập nhật skill `learning-task-runner` để Codex tự bảo trì `.codex/plans/codex-execution-plan.md` trong lúc làm task khi phát hiện thiếu/sai nhỏ.
- Changed:
  - Thêm mục `Execution Plan Maintenance` vào workflow.
  - Cho phép Codex tự cập nhật execution plan với dependency/TODO/ASSUMPTION hoặc note lỗi thời rõ ràng.
  - Yêu cầu hỏi owner trước khi đổi lớn về milestone, subtask, scope, stack hoặc kiến trúc.
  - Yêu cầu final response nói rõ execution plan có được cập nhật hay không.
- Files touched:
  - `.codex/skills/learning-task-runner/SKILL.md`
  - `.codex/skills/learning-task-runner/agents/openai.yaml`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/learning-task-runner`
- Notes:
  - Rule mới chỉ áp dụng cho bảo trì roadmap nhỏ; thay đổi kế hoạch lớn vẫn phải hỏi owner trước.

## 2026-07-07 — M0.1 monorepo foundation

- Summary: Khởi tạo nền monorepo Turborepo với Next.js web app, NestJS API app và shared package TypeScript.
- Changed:
  - Tạo workspace `pnpm` cho `apps/*` và `packages/*`.
  - Tạo root scripts `dev`, `build`, `lint`, `typecheck` chạy qua Turborepo.
  - Tạo `apps/web` dùng Next.js App Router, TypeScript và Tailwind CSS nền.
  - Tạo `apps/api` dùng NestJS TypeScript với controller/service mặc định.
  - Tạo `packages/shared` với constants, schemas và types dùng chung.
  - Thêm `.gitignore`, lockfile và cấu hình approved builds cho dependency native hợp lệ.
- Files touched:
  - `.gitignore`
  - `package.json`
  - `pnpm-workspace.yaml`
  - `pnpm-lock.yaml`
  - `turbo.json`
  - `tsconfig.base.json`
  - `apps/web/**`
  - `apps/api/**`
  - `packages/shared/**`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `pnpm install`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm --filter @learning-path/api start` with a short curl check, then server was stopped.
  - `pnpm --filter @learning-path/web start` with a short curl check, then server was stopped.
- Notes:
  - `pnpm` was not available locally, so `pnpm@11.10.0` was installed globally to satisfy the M0.1 install check.
  - `pnpm approve-builds --all` approved `esbuild` and `sharp` build scripts in workspace config.
  - Execution plan checked; no update needed for M0.1.

## 2026-07-07 — Add beginner README

- Summary: Thêm README ngắn gọn hướng dẫn người mới cài dependencies, chạy local và hiểu cấu trúc repo.
- Changed:
  - Tạo hướng dẫn cài `pnpm`, chạy `pnpm dev`, mở front-end/back-end local.
  - Ghi các lệnh kiểm tra cơ bản và cấu trúc thư mục chính.
  - Thêm cách giao task cho Codex bằng `/task`.
- Files touched:
  - `README.md`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - Not run: docs-only change.
- Notes:
  - Không thay đổi code production.

## 2026-07-07 — Fix API root 500

- Summary: Sửa lỗi `GET /` của NestJS API trả 500 do `AppService` không được inject khi chạy dev bằng `tsx`.
- Changed:
  - Khai báo injection tường minh `@Inject(AppService)` trong `AppController`.
- Files touched:
  - `apps/api/src/app.controller.ts`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `curl -i http://localhost:4100/` while running `API_PORT=4100 pnpm --filter @learning-path/api dev`
  - `pnpm typecheck`
  - `pnpm build`
  - `API_PORT=4100 pnpm --filter @learning-path/api start` with a short curl check, then server was stopped.
- Notes:
  - Existing API process on port `4000` must be restarted to load this fix.

## 2026-07-07 — Add bug fix runner skill

- Summary: Thêm skill project-local `bug-fix-runner` cho lệnh `/fix bug mô tả lỗi`.
- Changed:
  - Tạo workflow đọc docs liên quan, reproduce lỗi, tìm root cause, sửa tối thiểu và verify.
  - Yêu cầu cập nhật changelog, bảo toàn thay đổi unrelated và giải thích luồng kỹ thuật sau fix.
  - Thêm metadata UI cho skill trong `agents/openai.yaml`.
- Files touched:
  - `.codex/skills/bug-fix-runner/SKILL.md`
  - `.codex/skills/bug-fix-runner/agents/openai.yaml`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/bug-fix-runner`
- Notes:
  - Skill nằm trong `.codex/skills` của dự án, không lưu toàn cục.

## 2026-07-07 — Clarify bug fix final report

- Summary: Cập nhật skill `bug-fix-runner` để sau khi fix bug Codex bắt buộc nói rõ nguyên nhân và cách xử lý.
- Changed:
  - Làm rõ metadata skill về yêu cầu giải thích nguyên nhân bug và hướng xử lý.
  - Đổi phần final response thành `Nguyên nhân bug` và `Cách xử lý`.
  - Yêu cầu không gộp nguyên nhân và fix thành mô tả mơ hồ; nếu chưa chắc phải ghi rõ assumption.
- Files touched:
  - `.codex/skills/bug-fix-runner/SKILL.md`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/bug-fix-runner`
- Notes:
  - Không thay đổi code production.

## 2026-07-07 — Include technical flow in bug fix handling

- Summary: Cập nhật skill `bug-fix-runner` để mục `Cách xử lý` sau fix bug nêu ngắn gọn cả luồng kỹ thuật đã áp dụng.
- Changed:
  - Yêu cầu `Cách xử lý` giải thích đủ ý: đã sửa gì, vì sao sửa đúng root cause và luồng code/data đi qua đâu.
  - Gộp luồng kỹ thuật vào mục `Cách xử lý` để final response dễ đọc hơn.
- Files touched:
  - `.codex/skills/bug-fix-runner/SKILL.md`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/bug-fix-runner`
- Notes:
  - Không thay đổi code production.

## 2026-07-07 — Add commit runner skill

- Summary: Thêm skill project-local `commit-runner` cho lệnh `/commit`.
- Changed:
  - Tạo workflow tự kiểm tra worktree, changelog, diff và safety gate trước khi commit.
  - Yêu cầu commit message theo format ngắn gọn `<type>(<scope>): <summary>` nhưng đủ ý chính.
  - Yêu cầu báo lại commit hash, files chính, checks đã chạy và file còn uncommitted nếu có.
- Files touched:
  - `.codex/skills/commit-runner/SKILL.md`
  - `.codex/skills/commit-runner/agents/openai.yaml`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/commit-runner`
- Notes:
  - Skill nằm trong `.codex/skills` của dự án, không lưu toàn cục.
  - Skill không tự push, amend, rebase, reset hoặc squash nếu owner chưa yêu cầu rõ.

## 2026-07-07 — Add lean mode to task and bug skills

- Summary: Cập nhật skill `/task` và `/fix bug` để task/bug nhỏ có thể lược bớt quy trình nặng và hoàn thành nhanh hơn.
- Changed:
  - Thêm `Lean Mode For Small Tasks` vào `learning-task-runner`.
  - Thêm `Lean Mode For Small Bugs` vào `bug-fix-runner`.
  - Cho phép bỏ full build/test hoặc kiểm tra rộng khi thay đổi nhỏ, miễn là ghi rõ lý do skip.
  - Giữ các điểm bắt buộc: scope, stack, MVP, secret, unrelated changes và changelog khi có thay đổi file.
- Files touched:
  - `.codex/skills/learning-task-runner/SKILL.md`
  - `.codex/skills/bug-fix-runner/SKILL.md`
  - `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests:
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/learning-task-runner`
  - `python3 /Users/damanhtuan/.codex/skills/.system/skill-creator/scripts/quick_validate.py .codex/skills/bug-fix-runner`
- Notes:
  - Không thay đổi code production.

## 2026-07-07 — Shorten changelog style

- Summary: Rút gọn quy tắc changelog để chỉ ghi ý chính.
- Changed: Cập nhật `AGENTS.md` và các skill `/task`, `/fix`, `/commit`.
- Files: `AGENTS.md`, `.codex/skills/**`, `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests: `quick_validate.py` cho 3 skill.

## 2026-07-07 — Add mobile-first UI rule

- Summary: Chốt định hướng UI mobile-first nhưng vẫn hỗ trợ laptop/desktop tốt.
- Changed: Cập nhật rule front-end, nguyên tắc UI và skill `/task`.
- Files: `AGENTS.md`, `docs/08-ui-pages-and-components.md`, `.codex/skills/learning-task-runner/SKILL.md`
- Tests: `quick_validate.py` cho `learning-task-runner`.

## 2026-07-07 — Add UI operating brief

- Summary: Bổ sung hướng dẫn để Codex code UI đúng gu và giảm vòng sửa.
- Changed: Thêm UI direction, responsive patterns, checklist và prompt format.
- Files: `docs/08-ui-pages-and-components.md`, `.codex/skills/learning-task-runner/SKILL.md`
- Tests: `quick_validate.py` cho `learning-task-runner`.

## 2026-07-07 — Clarify tablet UI support

- Summary: Làm rõ UI phải tối ưu mobile-first và hỗ trợ tablet/iPad, laptop/desktop.
- Changed: Cập nhật responsive rule, checklist và skill `/task`.
- Files: `AGENTS.md`, `docs/08-ui-pages-and-components.md`, `.codex/skills/learning-task-runner/SKILL.md`
- Tests: `quick_validate.py` cho `learning-task-runner`.

## 2026-07-07 — Add UI design system docs

- Summary: Thiết lập tài liệu gu UI để Codex code đúng ý hơn và giảm vòng sửa.
- Changed: Thêm design system, UI reference notes và prompt mẫu UI theo từng giai đoạn.
- Files: `docs/11-ui-design-system.md`, `docs/ui-references/reference-notes.md`, `AGENTS.md`, `.codex/prompts/special-cases.md`, `.codex/skills/learning-task-runner/SKILL.md`
- Tests: `quick_validate.py` cho `learning-task-runner`.

## 2026-07-07 — Rename UI design system doc

- Summary: Đổi tên file UI design system theo thứ tự tài liệu.
- Changed: Cập nhật reference từ `docs/ui-design-system.md` sang `docs/11-ui-design-system.md`.
- Files: `docs/11-ui-design-system.md`, `AGENTS.md`, `docs/08-ui-pages-and-components.md`, `.codex/prompts/special-cases.md`, `.codex/skills/learning-task-runner/SKILL.md`
- Tests: `quick_validate.py` cho `learning-task-runner`.

## 2026-07-07 — Split task runner skills

- Summary: Tách workflow `/task` thành `/task-ui`, `/task-connect` và `/task-full`.
- Changed: Thêm 3 skill mới và chuyển `/task` cũ thành legacy/router.
- Files: `.codex/skills/task-*-runner/**`, `.codex/skills/learning-task-runner/SKILL.md`, `.codex/prompts/core-features.md`
- Tests: `quick_validate.py` cho 4 skill task runner.

## 2026-07-07 — Remove legacy task skill

- Summary: Xóa skill `/task` cũ, chỉ giữ 3 skill task mới.
- Changed: Cập nhật README, prompt và bug-fix next action sang `/task-ui`, `/task-connect`, `/task-full`.
- Files: `.codex/skills/learning-task-runner/**`, `README.md`, `.codex/prompts/core-features.md`, `.codex/skills/bug-fix-runner/SKILL.md`
- Tests: `quick_validate.py` cho 3 skill task mới và `bug-fix-runner`.

## 2026-07-07 — Rename task skill folders

- Summary: Đổi tên thư mục skill task trùng với câu lệnh kích hoạt.
- Changed: `task-ui-runner`, `task-connect-runner`, `task-full-runner` thành `task-ui`, `task-connect`, `task-full`.
- Files: `.codex/skills/task-ui/**`, `.codex/skills/task-connect/**`, `.codex/skills/task-full/**`
- Tests: `quick_validate.py` cho 3 skill task.

## 2026-07-07 — Rename command skill folders

- Summary: Đổi tên các skill còn lại cho khớp lệnh kích hoạt.
- Changed: `bug-fix-runner` thành `fix-bug`, `commit-runner` thành `commit`.
- Files: `.codex/skills/fix-bug/**`, `.codex/skills/commit/**`
- Tests: `quick_validate.py` cho tất cả skill hiện có.

## 2026-07-07 — Expand task-connect scope

- Summary: Sửa `/task-connect` để code API còn thiếu rồi kết nối UI.
- Changed: Cho phép implement backend API đầy đủ theo phạm vi subtask/API contract rồi connect UI.
- Files: `.codex/skills/task-connect/SKILL.md`, `.codex/prompts/core-features.md`, `.codex/prompts/special-cases.md`
- Tests: `quick_validate.py` cho `task-connect`.

## 2026-07-07 — Tighten Codex workflow docs

- Summary: Chuẩn hóa execution plan, UI token và screenshot workflow để Codex ít phải tự đoán.
- Changed: Thống nhất `.codex/plans/codex-execution-plan.md`, thêm UI token mặc định và screenshot path.
- Files: `AGENTS.md`, `docs/08-ui-pages-and-components.md`, `docs/09-implementation-plan.md`, `docs/11-ui-design-system.md`, `.codex/skills/**`, `.codex/prompts/special-cases.md`
- Tests: `quick_validate.py` cho 5 skill; `git diff --check`.

## 2026-07-07 — Guard task-ui non-UI tasks

- Summary: Thêm rule để `/task-ui` dừng sớm nếu subtask không có phần UI.
- Changed: Gợi ý chuyển sang `/task-full` hoặc lệnh phù hợp thay vì sửa file sai mode.
- Files: `.codex/skills/task-ui/SKILL.md`
- Tests: `quick_validate.py` cho `task-ui`; `git diff --check`.

## 2026-07-07 — Add approved UI pattern memory

- Summary: Thêm cơ chế lưu pattern UI khi owner xác nhận "ưng rồi/ok rồi".
- Changed: Tạo `approved-patterns.md` và cập nhật rule cho UI docs, `/task-ui`, `/task-full`.
- Files: `docs/ui-references/approved-patterns.md`, `docs/11-ui-design-system.md`, `AGENTS.md`, `.codex/skills/**`
- Tests: `quick_validate.py` cho 5 skill; `git diff --check`.

## 2026-07-07 — Tighten task-connect guardrails

- Summary: Siết `/task-connect` để không chạy khi chưa có UI và vẫn giữ pattern UI đã duyệt.
- Changed: Đọc `approved-patterns.md`, dừng sớm nếu chưa có UI/mock UI, đánh dấu prompt generic là fallback.
- Files: `.codex/skills/task-connect/SKILL.md`, `.codex/prompts/core-features.md`
- Tests: `quick_validate.py` cho `task-connect`; `git diff --check`.

## 2026-07-07 — Expand README workflow guide

- Summary: Bổ sung hướng dẫn sử dụng dự án và quy trình các skill Codex.
- Changed: Mô tả `/task-ui`, `/task-connect`, `/task-full`, `/fix bug`, `/commit` và luồng UI review.
- Files: `README.md`
- Tests: `git diff --check -- README.md`.

## 2026-07-07 — Complete M0.2 local tooling

- Summary: Hoàn thiện nền chạy local với env mẫu, lint/format, Docker local và API health check.
- Changed: Thêm ESLint/Prettier, `.env.example`, Docker dev cho web/API/Redis và `GET /api/v1/health`.
- Files: `package.json`, `apps/**`, `packages/shared/package.json`, `.env.example`, `docker-compose.yml`, `README.md`
- Tests: `pnpm lint`; `pnpm typecheck`; `pnpm format:check`; `pnpm build`; `docker compose config`; `curl http://localhost:4010/api/v1/health`.
- Notes: `docker compose build` not run: Docker daemon is not available.

## 2026-07-07 — Clarify Codex-maintained files

- Summary: Làm rõ trong README các file Codex có thể tự cập nhật khi thực hiện task.
- Changed: Ghi rule cho changelog, execution plan, approved UI patterns và docs contract/schema/AI.
- Files: `README.md`
- Tests: `git diff --check -- README.md .codex/changelog/CHANGELOG_2026-07-07_codex.md`.

## 2026-07-07 — Add Codex-maintained files rule

- Summary: Bổ sung rule cấp cao trong `AGENTS.md` cho các file Codex có thể tự cập nhật khi làm task.
- Changed: Liệt kê execution plan, changelog, approved UI patterns và docs API/database/AI/env được cập nhật khi phù hợp.
- Files: `AGENTS.md`
- Tests: `git diff --check -- AGENTS.md .codex/changelog/CHANGELOG_2026-07-07_codex.md`.

## 2026-07-07 — Shorten AGENTS coordination rules

- Summary: Rút gọn `AGENTS.md` thành file điều phối cấp cao để giảm context cho Codex.
- Changed: Giữ rule đọc docs, routing map, scope/stack guard, changelog, DoD; chuyển chi tiết sang docs chuyên môn.
- Files: `AGENTS.md`
- Tests: `git diff --check -- AGENTS.md .codex/changelog/CHANGELOG_2026-07-07_codex.md`.

## 2026-07-07 — Split implementation details by milestone

- Summary: Tách chi tiết implementation theo từng milestone để Codex đọc đúng file nhỏ hơn.
- Changed: Tạo `docs/implementation/M0.md` đến `M14.md`, cập nhật plan/skill/prompt và thêm hướng dẫn đọc nhanh cho docs dài.
- Files: `docs/implementation/**`, `docs/09-implementation-plan.md`, `AGENTS.md`, `README.md`, `.codex/skills/**`, `.codex/prompts/**`, `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/06-ai-rag-spec.md`
- Tests: `rg` kiểm tra reference cũ; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Split database and API docs by domain

- Summary: Rút gọn `docs/04` và `docs/05` thành index, tách chi tiết sang thư mục domain.
- Changed: Thêm `docs/database/**` và `docs/api/**`, cập nhật AGENTS/README/skill/prompt để đọc file con phù hợp.
- Files: `docs/04-database-model.md`, `docs/05-api-contract.md`, `docs/database/**`, `docs/api/**`, `AGENTS.md`, `README.md`, `.codex/skills/**`, `.codex/prompts/**`, `docs/06-ai-rag-spec.md`
- Tests: Kiểm tra đủ 44 section database/API; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Rewrite README for beginner workflow

- Summary: Viết lại README để người mới hiểu cách chạy dự án và cơ chế từng skill Codex.
- Changed: Làm rõ cơ chế map `Mx.y -> docs/implementation/Mx.md`, cách đọc database/API file con và quy trình `/task-ui`, `/task-connect`, `/task-full`, `/fix bug`, `/commit`.
- Files: `README.md`
- Tests: `rg` kiểm tra heading/cơ chế chính; `git diff --check`.

## 2026-07-07 — Add feature change skills

- Summary: Thêm skill cho sửa, thêm và xóa tính năng theo hướng docs-first.
- Changed: Tạo `/update-feature`, `/add-feature`, `/delete-feature` và cập nhật README.
- Files: `.codex/skills/update-feature/SKILL.md`, `.codex/skills/add-feature/SKILL.md`, `.codex/skills/delete-feature/SKILL.md`, `README.md`
- Tests: Kiểm tra frontmatter skill; `rg` kiểm tra README; `git diff --check`.

## 2026-07-07 — Add change-ui skill

- Summary: Thêm skill `/change-ui` để chỉnh UI theo feedback mà chưa chốt vào tài liệu thiết kế.
- Changed: Tạo skill UI-only, chỉ cập nhật approved UI docs sau khi owner nói UI đã ưng/chốt; cập nhật README.
- Files: `.codex/skills/change-ui/SKILL.md`, `README.md`
- Tests: Kiểm tra frontmatter skill; `rg` kiểm tra README; `git diff --check`.

## 2026-07-07 — Clarify feature task-code rules

- Summary: Làm rõ cách các skill feature sửa, thêm hoặc bỏ mã task khi roadmap thay đổi.
- Changed: Bổ sung rule task code cho `/update-feature`, `/add-feature`, `/delete-feature` và README.
- Files: `.codex/skills/update-feature/SKILL.md`, `.codex/skills/add-feature/SKILL.md`, `.codex/skills/delete-feature/SKILL.md`, `README.md`
- Tests: `rg` kiểm tra rule task-code; `git diff --check`.

## 2026-07-07 — Add defer feature skill

- Summary: Thêm skill chuyển tính năng sang version sau mà không xóa khỏi tài liệu.
- Changed: Tạo `/move-feature-to-next-version` và cập nhật README.
- Files: `.codex/skills/move-feature-to-next-version/SKILL.md`, `README.md`
- Tests: Kiểm tra frontmatter skill; `rg` kiểm tra README; `git diff --check`.

## 2026-07-07 — Add refactor skill

- Summary: Thêm skill `/refactor` để cải thiện cấu trúc code mà không đổi behavior.
- Changed: Tạo skill refactor có guard không đổi API/schema/UI/business logic và cập nhật README.
- Files: `.codex/skills/refactor/SKILL.md`, `README.md`
- Tests: Kiểm tra frontmatter skill; `rg` kiểm tra README; `git diff --check`.

## 2026-07-07 — Make feature skills docs-only by default

- Summary: Làm rõ `/add-feature`, `/update-feature`, `/delete-feature` chỉ chỉnh docs/roadmap mặc định.
- Changed: Cấm code production nếu owner không yêu cầu rõ và bắt buộc gợi ý bước tiếp theo kèm mã task nếu có.
- Files: `.codex/skills/add-feature/SKILL.md`, `.codex/skills/update-feature/SKILL.md`, `.codex/skills/delete-feature/SKILL.md`, `README.md`
- Tests: `rg` kiểm tra docs-only rules; `git diff --check`.

## 2026-07-07 — Optimize Codex prompts and skill metadata

- Summary: Rà soát bộ docs/skill và rút gọn prompt cũ để tránh trùng lặp, sai lệch với skill mới.
- Changed: Rút gọn `.codex/prompts`, thêm metadata `agents/openai.yaml` cho các skill mới.
- Files: `.codex/prompts/core-features.md`, `.codex/prompts/special-cases.md`, `.codex/skills/*/agents/openai.yaml`
- Tests: `wc -l`; `rg` kiểm tra reference cũ/mâu thuẫn; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add next-task and review-docs skills

- Summary: Thêm 2 skill nhẹ để chọn task tiếp theo và rà soát docs/skill.
- Changed: Tạo `/next-task`, `/review-docs` và thêm bảng chọn lệnh nhanh vào README.
- Files: `.codex/skills/next-task/**`, `.codex/skills/review-docs/**`, `README.md`
- Tests: `quick_validate.py` cho 2 skill; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — M1.1 Prisma foundation

- Summary: Thiết lập Prisma foundation cho NestJS API và pgvector migration nền.
- Changed: Thêm Prisma 7 config/client adapter, PrismaModule/PrismaService skeleton và migration bật extension `vector`.
- Files: `apps/api/prisma/**`, `apps/api/src/common/prisma/**`, `apps/api/package.json`, `pnpm-lock.yaml`
- Tests: `pnpm --filter @learning-path/api db:validate`; `pnpm --filter @learning-path/api db:generate`; `pnpm typecheck`; `pnpm lint`; `pnpm build`; `pnpm format:check`.
- Notes: Prisma v7 dùng `apps/api/prisma.config.ts` cho `DATABASE_URL`; `DIRECT_URL` giữ trong env docs cho trường hợp Supabase cần tách URL sau.

## 2026-07-07 — Add task modes to implementation docs

- Summary: Gắn `Mode` cho từng subtask để Codex biết task chỉ UI, API, DB, worker/integration hay docs.
- Changed: Thêm mode cho 72 subtask và cập nhật README/skill task để đọc mode trước khi làm.
- Files: `docs/implementation/**`, `docs/09-implementation-plan.md`, `README.md`, `.codex/skills/task-*/SKILL.md`, `AGENTS.md`
- Tests: `rg` kiểm tra 72/72 subtask có mode; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Fill missing UI roadmap tasks

- Summary: Rà soát UI docs với roadmap và thêm các task UI còn thiếu.
- Changed: Thêm task cho auth UI, course browsing UI, document upload UI, student/admin dashboard, discount UI và AI generation panel; thêm bảng UI coverage.
- Files: `docs/implementation/**`, `docs/09-implementation-plan.md`, `docs/08-ui-pages-and-components.md`, `.codex/plans/codex-execution-plan.md`
- Tests: `rg` kiểm tra 79/79 subtask có mode; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Expand screen coverage matrix

- Summary: Mở rộng bảng coverage UI để map từng màn sang task UI, API, DB và integration liên quan.
- Changed: Thay bảng `Task chính` bằng screen coverage matrix nhiều cột trong `docs/08-ui-pages-and-components.md`.
- Files: `docs/08-ui-pages-and-components.md`
- Tests: `rg` kiểm tra bảng mới; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Clarify vertical-slice task strategy

- Summary: Làm rõ chiến lược mặc định là làm task theo lát dọc hoàn chỉnh khi scope đã rõ.
- Changed: Cập nhật `docs/09-implementation-plan.md` để ưu tiên `/task-full`, chỉ tách `/task-ui` và `/task-connect` khi cần review UI trước.
- Files: `docs/09-implementation-plan.md`
- Tests: `rg` kiểm tra rule lát dọc; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Expand technical explanation rules

- Summary: Làm rõ phần giải thích kỹ thuật phải giúp owner học được luồng code và kỹ thuật đã dùng.
- Changed: Cập nhật skill task/fix/refactor và README để bắt buộc mục `Giải thích kỹ thuật dễ hiểu`.
- Files: `.codex/skills/task-*/SKILL.md`, `.codex/skills/fix-bug/SKILL.md`, `.codex/skills/refactor/SKILL.md`, `README.md`
- Tests: `rg` kiểm tra rule giải thích kỹ thuật; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add feature-first learning notes

- Summary: Thêm sổ tay kỹ thuật feature-first để lưu kiến thức từ phần giải thích kỹ thuật sau task.
- Changed: Tạo `docs/learning-notes/`, thêm note nền Prisma và cập nhật skill/README/AGENTS để merge kiến thức, tránh trùng lặp.
- Files: `docs/learning-notes/**`, `.codex/skills/task-*/SKILL.md`, `.codex/skills/fix-bug/SKILL.md`, `.codex/skills/refactor/SKILL.md`, `README.md`, `AGENTS.md`
- Tests: `rg` kiểm tra learning notes rules; `quick_validate.py` cho 5 skill; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add commit verification modes

- Summary: Cập nhật `/commit` để có smart/fast/full mode, giảm thời gian commit khi diff nhỏ.
- Changed: Thêm rule chọn check theo diff và hướng dẫn `/commit fast`, `/commit full` trong README.
- Files: `.codex/skills/commit/SKILL.md`, `README.md`
- Tests: `quick_validate.py` cho commit skill; `rg` kiểm tra mode; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add plan mode for task skills

- Summary: Thêm cú pháp `plan` cho `/task-ui`, `/task-connect` và `/task-full` để Codex lập kế hoạch rồi chờ duyệt.
- Changed: Bổ sung approval-gated plan mode, cập nhật skill metadata và README.
- Files: `.codex/skills/task-ui/**`, `.codex/skills/task-connect/**`, `.codex/skills/task-full/**`, `README.md`
- Tests: `quick_validate.py` cho task/commit skills; `rg` kiểm tra plan mode; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Clarify lean mode for small tasks

- Summary: Làm rõ rule tối ưu tốc độ cho task nhỏ bằng lean mode.
- Changed: Cập nhật AGENTS, README và skill task/refactor để chỉ chạy check tối thiểu khi rủi ro thấp.
- Files: `AGENTS.md`, `README.md`, `.codex/skills/task-*/SKILL.md`, `.codex/skills/refactor/SKILL.md`
- Tests: `quick_validate.py` cho task/refactor skills; `rg` kiểm tra lean mode; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add do approval skill

- Summary: Thêm skill `/do` để duyệt plan gần nhất và bắt đầu triển khai.
- Changed: Tạo skill `do`, cập nhật task plan mode và README để dùng `/do` như câu "ok làm đi".
- Files: `.codex/skills/do/**`, `.codex/skills/task-*/SKILL.md`, `README.md`
- Tests: `quick_validate.py` cho do/task skills; `rg` kiểm tra /do; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add lightweight Codex context docs

- Summary: Bổ sung bộ context/coverage/decision docs nhẹ để Codex định hướng nhanh khi làm task.
- Changed: Thêm current context, code index, dependency graph, feature coverage matrix, decision log và rule dùng chúng trong skill liên quan.
- Files: `.codex/context/**`, `docs/implementation/dependency-graph.md`, `docs/implementation/feature-coverage-matrix.md`, `docs/decisions/**`, `.codex/skills/**`, `AGENTS.md`, `README.md`, `docs/09-implementation-plan.md`, `docs/implementation/README.md`
- Tests: `git diff --check`.

## 2026-07-07 — Review Codex docs consistency

- Summary: Rà soát docs/skill workflow và đồng bộ README với các file context mới.
- Changed: Bổ sung danh sách file context/coverage/decision vào mục file Codex có thể tự cập nhật.
- Files: `README.md`, `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests: `rg` kiểm tra reference; kiểm tra 79/79 task có mode; kiểm tra 14 skill có frontmatter; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add mobile performance UX rules

- Summary: Bổ sung chuẩn UI mượt trên mobile, hiệu năng cao và độ trễ cảm nhận thấp.
- Changed: Thêm performance/mobile UX checklist vào design system và nối rule vào AGENTS, README, skill UI/task.
- Files: `docs/11-ui-design-system.md`, `AGENTS.md`, `README.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/task-connect/SKILL.md`, `.codex/skills/task-full/SKILL.md`, `.codex/skills/change-ui/SKILL.md`, `.codex/context/current-context.md`
- Tests: `rg` kiểm tra performance/mobile UX rule; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add system performance observability docs

- Summary: Thêm chuẩn hiệu năng toàn hệ thống cho frontend, API, database, worker, AI/RAG và observability.
- Changed: Tạo `docs/12-performance-and-observability.md` và nối vào AGENTS, README, architecture docs, task/fix/refactor skills.
- Files: `docs/12-performance-and-observability.md`, `AGENTS.md`, `README.md`, `docs/03-technical-architecture.md`, `docs/11-ui-design-system.md`, `.codex/skills/task-*/SKILL.md`, `.codex/skills/fix-bug/SKILL.md`, `.codex/skills/refactor/SKILL.md`, `.codex/context/current-context.md`
- Tests: `rg` kiểm tra reference performance/observability; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Add SEO public discovery docs

- Summary: Thêm chuẩn SEO/public discovery để Codex làm đúng nền top Google cho trang public.
- Changed: Tạo `docs/13-seo-and-content-discovery.md` và nối vào AGENTS, README, UI/architecture docs, skill task/change/feature/fix/refactor.
- Files: `docs/13-seo-and-content-discovery.md`, `AGENTS.md`, `README.md`, `docs/03-technical-architecture.md`, `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`, `.codex/skills/**`, `.codex/context/current-context.md`
- Tests: `rg` kiểm tra reference SEO/public discovery; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Review docs workflow consistency

- Summary: Rà soát docs/skill sau phần performance và SEO, sửa rule check skill không phụ thuộc script chưa có.
- Changed: Làm rõ fallback frontmatter check, bổ sung performance/SEO vào README, prompt và review-docs skill.
- Files: `AGENTS.md`, `README.md`, `.codex/skills/commit/SKILL.md`, `.codex/skills/review-docs/SKILL.md`, `.codex/prompts/*.md`
- Tests: `rg` kiểm tra stale references; kiểm tra frontmatter skill; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Shorten README as docs router

- Summary: Rút README thành hướng dẫn nhanh cho người mới, giảm lặp chi tiết với AGENTS và skill docs.
- Changed: Giữ README làm cửa vào/router; trỏ chi tiết sang `AGENTS.md`, docs nguồn và `.codex/skills/*/SKILL.md`.
- Files: `README.md`
- Tests: `rg` kiểm tra stale references; `pnpm format:check`; `git diff --check`.

## 2026-07-07 — Include mode in next task suggestions

- Summary: Cập nhật các skill Codex để khi gợi ý task tiếp theo luôn kèm mode và mô tả ngắn của task.
- Changed:
  - Bổ sung yêu cầu `/next-task` đọc milestone để lấy `Mode`, scope và mô tả một câu cho task được đề xuất.
  - Đồng bộ output các skill có gợi ý roadmap tiếp theo như `/task-full`, `/task-ui`, `/task-connect`, `/do`, `/add-feature`, `/update-feature`, `/delete-feature`, `/fix bug`.
- Files: `.codex/skills/next-task/SKILL.md`, `.codex/skills/next-task/agents/openai.yaml`, `.codex/skills/task-full/SKILL.md`, `.codex/skills/task-ui/SKILL.md`, `.codex/skills/task-connect/SKILL.md`, `.codex/skills/do/SKILL.md`, `.codex/skills/add-feature/SKILL.md`, `.codex/skills/update-feature/SKILL.md`, `.codex/skills/delete-feature/SKILL.md`, `.codex/skills/fix-bug/SKILL.md`, `.codex/changelog/CHANGELOG_2026-07-07_codex.md`
- Tests: `quick_validate.py` cho các skill đã sửa; `git diff --check`.
- Notes: Không thay đổi code production; không cần chạy build/test app.

## 2026-07-07 — Fix docs review findings

- Summary: Sửa các điểm lệch scope/routing trong docs và skill sau review bộ tài liệu Codex.
- Changed:
  - Làm rõ `M3.5` không kéo payment/payOS sớm, cập nhật dependency graph và execution plan baseline.
  - Bổ sung rule đọc performance docs cho các skill feature/change UI khi task chạm list/search/cache/query/job/latency.
- Files: `docs/08-ui-pages-and-components.md`, `docs/implementation/dependency-graph.md`, `.codex/skills/**`, `.codex/plans/codex-execution-plan.md`
- Tests: `quick_validate.py` cho các skill đã sửa; `rg` kiểm tra reference; `pnpm format:check`; `git diff --check`.
- Notes: Không thay đổi code production.

## 2026-07-07 — Add docs map and refresh README

- Summary: Thêm bản đồ đọc docs một trang và rút README thành cửa vào nhanh cho owner/Codex.
- Changed:
  - Tạo `docs/00-docs-map.md` để định tuyến tài liệu theo mục tiêu/task.
  - Rút README thành quickstart/cheatsheet, đồng thời nối `AGENTS.md` và skill review docs tới docs map.
- Files: `docs/00-docs-map.md`, `README.md`, `AGENTS.md`, `.codex/skills/review-docs/SKILL.md`
- Tests: `quick_validate.py` cho review-docs skill; `rg` kiểm tra reference; `pnpm format:check`; `pnpm exec prettier --check README.md docs/00-docs-map.md`; `git diff --check`.
- Notes: Không thay đổi code production.

## 2026-07-07 — Clarify next task core docs guidance

- Summary: Làm rõ output `/next-task` để nêu ngắn gọn tài liệu cốt lõi owner nên đọc trước.
- Changed:
  - Bổ sung bước chọn 2-4 file docs cốt lõi, kèm đúng heading/subsection cần đọc trong file lớn.
  - Siết mục phụ thuộc/lưu ý thành trạng thái git, dependency và blocker cụ thể thay vì câu chung chung.
- Files: `.codex/skills/next-task/SKILL.md`, `.codex/skills/next-task/agents/openai.yaml`
- Tests: `quick_validate.py` cho next-task skill; `rg` kiểm tra output guidance; `pnpm format:check`; `pnpm exec prettier --check .codex/skills/next-task/SKILL.md .codex/skills/next-task/agents/openai.yaml`; `git diff --check`.
- Notes: Không thay đổi code production.
