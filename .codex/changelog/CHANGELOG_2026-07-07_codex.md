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
