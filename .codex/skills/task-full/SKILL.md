---
name: task-full
description: Implement or plan complete roadmap subtasks for the Vietnamese learning-path project from commands like "/task-full M7.1", "/task-full M3.4", or "/task-full plan M1.2". Use when Codex must either do everything needed for a subtask end to end, including backend/API/database/UI/worker/docs when the implementation plan requires them, or produce an approval-gated plan first when the command contains "plan"; read relevant docs, keep scope to the requested subtask, apply mobile-first UI rules when UI is involved, run proportional verification, update changelog after implementation, explain technical flow, and suggest the next subtask.
---

# Task Full Runner

Use this skill when the owner wants the requested subtask completed end to end in one pass.

## Command Parsing

Accept:

- `/task-full M7.1`
- `/task-full: M7.1`
- `/task-full plan M7.1`
- `/task-full plan: M7.1`
- `/task-full M1.1 + M1.2`

Parse subtask IDs in order. If `plan` appears after the command and before the task IDs, enable plan mode. Multiple IDs are allowed only when explicitly listed. Execute sequentially and stop if one creates unresolved risk.

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
6. Use the `Task routing map` in `AGENTS.md` to read all relevant docs.
7. If `Mode` is `UI only` or `UI + API`, also read:
   - `docs/11-ui-design-system.md`
   - `docs/08-ui-pages-and-components.md`
   - `docs/ui-references/reference-notes.md` if relevant.
   - `docs/ui-references/approved-patterns.md` if present and relevant.
8. Inspect existing code for touched modules.
9. Give a short plan: subtask, mode, docs read, modules/files, database/API/docs impact, commands.

In plan mode, stop after this plan and wait for approval.

## Scope Rules

- Implement only the requested subtask's scope and `Mode`.
- Do not add features outside MVP.
- Do not change the approved stack.
- If the task is too large, split the work and say which part is being completed.
- If a dependency subtask is missing, stop or implement only safe scaffold and explain the blocker.
- For UI work, follow mobile-first, tablet/iPad, and laptop/desktop rules.
- For UI work, use the default UI tokens from `docs/11-ui-design-system.md` and save useful review screenshots under `.codex/screenshots/`.
- For database/API/AI behavior changes, update the corresponding docs. `docs/04-database-model.md` and `docs/05-api-contract.md` are indexes; update matching files in `docs/database/` and `docs/api/` when domain details change.

## Full Implementation Rules

Depending on the subtask, do what is necessary:

- Backend/API: controller, DTO/validation, guard/RBAC, service, Swagger if project pattern exists.
- Database: Prisma schema/migration/seed updates when required.
- Front-end: page/component/hooks/forms/state and responsive UI.
- Shared package: types/schemas/constants used by both apps.
- Worker/integration: queue/provider/job code when required by docs.
- Docs: update API/database/AI/UI/env docs only when behavior changes.
- Codex context: update `.codex/context/current-context.md`, `.codex/context/code-index.md`, `docs/implementation/feature-coverage-matrix.md`, or `docs/implementation/dependency-graph.md` only when the completed task changes repo state, module paths, feature status, or dependencies.
- UI approval memory: if the owner says the UI is approved after review, record the pattern in `docs/ui-references/approved-patterns.md`; update `docs/11-ui-design-system.md` only for broad design rules.

## Verification

Run checks proportional to risk:

- Typecheck for touched packages.
- Focused tests where available.
- Build/lint when shared or production surface changed.
- Browser/curl/API checks when practical.
- For UI, mention responsive viewports checked or skipped and screenshot paths if created.

## Lean Mode For Small Tasks

For tiny, low-risk tasks, optimize for speed.

Allowed reductions:

- Skip full repo lint/build/test when the change is isolated.
- Run the smallest useful check: `git diff --check`, focused typecheck, focused validator, small curl, or manual verification with a note.
- Keep the plan and final response shorter.
- For docs-only or wording-only changes, `Not run: docs-only` is acceptable.

Non-negotiable:

- Do not skip safety checks for secrets, scope, stack, MVP, or unrelated dirty files.
- Do not skip changelog when repository files changed in a commit-worthy way.
- If a larger check is skipped, state `Not run: <reason>` in changelog and final response.
- Do not use lean mode for auth/RBAC, payment, database/schema/migration, API contract, AI/RAG, worker/queue, storage, notification/realtime, security, or multi-module behavior changes.

## Learning Notes

After implementation, decide whether the technical explanation has long-term learning value for the owner.

- If yes, update `docs/learning-notes/`.
- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer feature-first notes in `docs/learning-notes/features/` for end-to-end product flows.
- Use `docs/learning-notes/foundation/` only for reusable technical foundations that do not belong to one feature.
- Merge into an existing note when possible; do not copy the final response verbatim and do not duplicate existing explanations.
- Update `docs/learning-notes/glossary.md` only for reusable terms that will appear across many notes.
- Update changelog if learning notes changed.
- If not updated, mention briefly in the final response, for example `Learning notes: Not updated, change was too small`.

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
- Suggested next subtask.

Update changelog using the concise format from `AGENTS.md`.
