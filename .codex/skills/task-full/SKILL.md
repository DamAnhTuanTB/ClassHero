---
name: task-full
description: Implement or plan complete roadmap subtasks for the Vietnamese learning-path project from commands like "/task-full M7.1", "/task-full M3.4", or "/task-full plan M1.2". Use when Codex must either do everything needed for a subtask end to end, including backend/API/database/UI/worker/docs when the implementation plan requires them, or produce an approval-gated plan first when the command contains "plan"; read relevant docs, keep scope to the requested subtask, apply mobile-first UI rules when UI is involved, run proportional verification, explain technical flow, and suggest the next subtask with its Mode and short description.
---

# Task Full Runner

Use this skill when the owner wants the requested subtask completed end to end in one pass.

## Command Parsing

Accept:

- `/task-full M7.1`
- `/task-full: M7.1`
- `/task-full plan M7.1`
- `/task-full plan: M7.1`
- `/task-full screenshot M7.1`
- `/task-full plan screenshot M7.1`
- `/task-full M1.1 + M1.2`

Parse subtask IDs in order. If `plan` appears after the command and before the task IDs, enable plan mode. Multiple IDs are allowed only when explicitly listed. Execute sequentially and stop if one creates unresolved risk.

If `screenshot` appears after the command, enable screenshot mode for UI portions only because the owner explicitly requested it. Per owner preference, do not run browser checks, Playwright UI, screenshots, or real interaction checks by default. Without the `screenshot` keyword or an explicit browser-check request, do not create/save screenshots and do not run browser/Playwright UI checks; use proportional static/focused code checks instead.

## Plan Mode

When the command contains `plan`, do approval-gated planning only.

- Read the same startup docs needed to make a reliable plan.
- Inspect existing code enough to identify likely files and risks.
- Do not edit files, run migrations, install packages, start implementation, update changelog, or stage/commit.
- Output a plan with:
  - subtask ID, mode, goal, and dependencies,
  - docs/code inspected,
  - files/modules likely to change,
  - implementation steps,
  - docs/database/API/AI/UI/env updates expected,
  - verification commands expected,
  - risks, blockers, assumptions, and questions.
- End by asking the owner to approve or revise the plan.
- If the owner later says `/do`, "ok", "làm đi", "triển khai đi", or similar, continue from the approved plan, re-check `git status --short`, re-read any docs/code that may have changed, then implement.
- If the owner revises the plan, update the plan and wait again before implementing.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read the requested subtask in `docs/09-implementation-plan.md` and the matching milestone file in `docs/implementation/` (for example `M8.3` -> `docs/implementation/M8.md`).
3. Read the subtask `Mode`.
4. If present, read `.codex/plans/codex-execution-plan.md`.
5. If useful for orientation, read `.codex/context/current-context.md`, `.codex/context/code-index.md`, `docs/implementation/dependency-graph.md`, and `docs/implementation/feature-coverage-matrix.md`.
6. Read `docs/14-source-code-structure.md` when the task creates, moves, or edits source files.
7. Use the `Task routing map` in `AGENTS.md` to read all relevant docs.
8. If `Mode` is `UI only` or `UI + API`, also read:
   - `docs/11-ui-design-system.md`
   - `docs/08-ui-pages-and-components.md`
   - `docs/ui-references/code-patterns.md` routing index and matching file/section in `docs/ui-references/code-patterns/` when the task creates or touches form, modal, detail grid, action button, upload, badge/status, loading/empty/error state, or another reusable UI code flow.
   - `docs/ui-references/reference-notes.md` if relevant.
   - `docs/ui-references/approved-patterns.md` if present and relevant.
9. If the task affects performance, latency, cache, list/search, database query, worker/job, AI/RAG, or observability, read `docs/12-performance-and-observability.md`.
10. If the task affects landing, public course list/detail, news/event public, metadata, slug, sitemap, robots, canonical, Open Graph, structured data, or public indexability, read `docs/13-seo-and-content-discovery.md`.
11. Inspect existing code for touched modules.
12. Decide source placement and reuse before editing: shared vs feature/domain, screen/component/hook/schema/data/utils, controller/service/select/serializer/utils/types, and alias imports.
13. Give a short plan: subtask, mode, docs read, modules/files/layers, reusable components/helpers, database/API/UI/SEO/docs impact, commands.

In plan mode, stop after this plan and wait for approval.

## Scope Rules

- Implement only the requested subtask's scope and `Mode`.
- Do not add features outside MVP.
- Do not change the approved stack.
- If the task is too large, split the work and say which part is being completed.
- If a dependency subtask is missing, stop or implement only safe scaffold and explain the blocker.
- For UI work, follow mobile-first, tablet/iPad, and laptop/desktop rules.
- For UI work, use the default UI tokens from `docs/11-ui-design-system.md`.
- For UI work, deliver production-like interaction, not static mockups. Mock data is fine, but controls that look interactive must have semantic elements, real state/handlers, and appropriate pressed/pending/disabled/loading feedback.
- Only create or save UI screenshots when screenshot mode is enabled by the command, for example `/task-full screenshot M3.4`.
- For UI work, apply `docs/11-ui-design-system.md` performance rules: smooth mobile interaction, immediate feedback, low perceived latency, stable skeleton/layout, and no heavy blocking animation/render.
- For database/API/AI behavior changes, update the corresponding docs. `docs/04-database-model.md` and `docs/05-api-contract.md` are indexes; update matching files in `docs/database/` and `docs/api/` when domain details change.
- For public/indexable page changes, follow `docs/13-seo-and-content-discovery.md` and update SEO/public docs if metadata, sitemap, robots, canonical, structured data, slug, or indexability rules change.

## Full Implementation Rules

Depending on the subtask, do what is necessary:

- Backend/API: controller, DTO/validation, guard/RBAC, service, Swagger if project pattern exists.
- Back-end imports in `apps/api/src` must use the native Node alias `#api/...` for internal files instead of `../` or `./`, including controller/service/DTO/guard/common/config/module imports.
- Back-end module files must be grouped by responsibility. Keep only `*.module.ts` at `apps/api/src/modules/<domain>` root; put HTTP handlers in `controllers/`, business orchestration in `services/`, DTOs in `dto/`, Prisma selects in `selectors/`, response mappers in `serializers/`, pure helpers/errors/normalizers in `utils/`, and exported local types in `types/`.
- Back-end HTTP errors must use reusable helpers from `apps/api/src/common/errors`; do not scatter direct Nest exception constructors with custom response bodies across controllers/services/utils.
- Database: Prisma schema/migration/seed updates when required.
- Front-end: page/component/hooks/forms/state and responsive, production-like interactive UI.
- Front-end source placement must follow `docs/14-source-code-structure.md`: route/page composes, feature screen orchestrates, hook handles state/query/form wiring, components render one implementation per file, schema/data/types/utils stay outside JSX, and shared components are reused before new variants are created.
- Front-end UI implementation must follow the closest matching pattern routed from `docs/ui-references/code-patterns.md` into `docs/ui-references/code-patterns/` before creating a new form/modal/detail/action/upload/badge/state flow. If no pattern fits, state the gap and keep the implementation easy to promote into a pattern after owner approval.
- Shared package: types/schemas/constants used by both apps.
- Worker/integration: queue/provider/job code when required by docs.
- Docs: update API/database/AI/UI/env docs only when behavior changes.
- Performance: follow `docs/12-performance-and-observability.md` for cache, pagination, slow queries, worker jobs, AI latency and measurement.
- SEO/public discovery: follow `docs/13-seo-and-content-discovery.md` for public pages, metadata, sitemap, robots, canonical, Open Graph, structured data and noindex for private routes.
- Codex context: update `.codex/context/current-context.md`, `.codex/context/code-index.md`, `docs/implementation/feature-coverage-matrix.md`, or `docs/implementation/dependency-graph.md` only when the completed task changes repo state, module paths, feature status, or dependencies.
- UI approval memory: if the owner says the UI is approved after review, record the visual/UX pattern in `docs/ui-references/approved-patterns.md`; if the UI creates or normalizes reusable implementation, also update `docs/ui-references/code-patterns.md` routing and the matching file in `docs/ui-references/code-patterns/`. Update `docs/11-ui-design-system.md` only for broad design rules.

## Verification

Run checks proportional to risk:

- Typecheck for touched packages.
- Focused tests where available.
- Build/lint when shared or production surface changed.
- Curl/API checks when practical for API/backend work.
- For UI, use static/focused checks by default and mention that owner self-checks responsive/tương tác. Include screenshot paths only when screenshot mode created them.
- For performance-sensitive work, mention what was measured or why measurement was skipped.

## Lean Mode For Small Tasks

For tiny, low-risk tasks, optimize for speed.

Allowed reductions:

- Skip full repo lint/build/test when the change is isolated.
- Run the smallest useful check: `git diff --check`, focused typecheck, focused validator, small curl, or manual verification with a note.
- Keep the plan and final response shorter.
- For docs-only or wording-only changes, `Not run: docs-only` is acceptable.

Non-negotiable:

- Do not skip safety checks for secrets, scope, stack, MVP, or unrelated dirty files.
- Do not update changelog during implementation; `/commit` will record the commit's main changes.
- If a larger check is skipped, state `Not run: <reason>` in the final response.
- If the owner writes `fast`, `check nhẹ`, or `sửa nhanh`, use lean verification only when the requested change is low risk; keep the full workflow for auth/RBAC, payment, database/schema/migration, API contract, AI/RAG, worker/queue, storage, notification/realtime, security, or multi-module behavior changes.
- Do not use lean mode for auth/RBAC, payment, database/schema/migration, API contract, AI/RAG, worker/queue, storage, notification/realtime, security, or multi-module behavior changes.

## Learning Notes

After implementation, decide whether the technical explanation has long-term learning value for the owner.

- If yes, update `docs/learning-notes/`.
- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer feature-first notes in `docs/learning-notes/features/` for end-to-end product flows.
- Use `docs/learning-notes/foundation/` only for reusable technical foundations that do not belong to one feature.
- Merge into an existing note when possible; do not copy the final response verbatim and do not duplicate existing explanations.
- Update `docs/learning-notes/glossary.md` only for reusable terms that will appear across many notes.
- Do not update changelog when learning notes change; `/commit` will record the commit's main changes.
- If not updated, mention briefly in the final response, for example `Learning notes: Not updated, change was too small`.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the implementation or plan is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when implementation or checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/task-full M2.1` or `/task-full plan M2.1`. For plan mode, say the plan is ready for approval. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Include:

- Completed `/task-full` ID(s).
- Main changes.
- Files changed.
- Commands run or skipped with reason.
- `Giải thích kỹ thuật dễ hiểu`:
  - Mục tiêu kỹ thuật: task này thêm/sửa năng lực gì trong hệ thống.
  - Luồng code: mô tả đường đi thực tế, ví dụ UI -> hook/API client -> controller -> service -> Prisma/provider -> database/cache -> response -> UI state.
  - Kỹ thuật đã dùng: giải thích ngắn mỗi kỹ thuật quan trọng được áp dụng, không chỉ liệt kê tên thư viện.
  - Vì sao làm vậy: lý do cách làm phù hợp với kiến trúc repo và scope MVP.
  - File quan trọng: entry point, file chứa logic chính, file cấu hình/schema/docs liên quan.
  - Bạn nên hiểu gì sau task này: 2-4 ý kiến thức rút ra.
- TODO/ASSUMPTION/blockers.
- Whether execution plan changed.
- Whether learning notes changed.
- Suggested next subtask: include the command, exact `Mode` from the milestone file, and a one-sentence description of what that task does.

Do not update changelog here. Changelog is written only during `/commit`, with one short, coherent entry for the whole commit.
