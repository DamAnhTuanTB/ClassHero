---
name: task-full
description: Implement complete roadmap subtasks for the Vietnamese learning-path project from commands like "/task-full M7.1" or "/task-full M3.4". Use when Codex must do everything needed for a subtask end to end, including backend/API/database/UI/worker/docs when the implementation plan requires them, read all relevant docs, keep scope to the requested subtask, apply mobile-first UI rules when UI is involved, run proportional verification, update changelog, explain technical flow, and suggest the next subtask.
---

# Task Full Runner

Use this skill when the owner wants the requested subtask completed end to end in one pass.

## Command Parsing

Accept:

- `/task-full M7.1`
- `/task-full: M7.1`
- `/task-full M1.1 + M1.2`

Parse subtask IDs in order. Multiple IDs are allowed only when explicitly listed. Execute sequentially and stop if one creates unresolved risk.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read the requested subtask in `docs/09-implementation-plan.md` and the matching milestone file in `docs/implementation/` (for example `M8.3` -> `docs/implementation/M8.md`).
3. If present, read `.codex/plans/codex-execution-plan.md`.
4. Use the `Task routing map` in `AGENTS.md` to read all relevant docs.
5. If UI is involved, also read:
   - `docs/11-ui-design-system.md`
   - `docs/08-ui-pages-and-components.md`
   - `docs/ui-references/reference-notes.md` if relevant.
   - `docs/ui-references/approved-patterns.md` if present and relevant.
6. Inspect existing code for touched modules.
7. Give a short plan: subtask, docs read, modules/files, database/API/docs impact, commands.

## Scope Rules

- Implement only the requested subtask's scope.
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
- UI approval memory: if the owner says the UI is approved after review, record the pattern in `docs/ui-references/approved-patterns.md`; update `docs/11-ui-design-system.md` only for broad design rules.

## Verification

Run checks proportional to risk:

- Typecheck for touched packages.
- Focused tests where available.
- Build/lint when shared or production surface changed.
- Browser/curl/API checks when practical.
- For UI, mention responsive viewports checked or skipped and screenshot paths if created.

Lean mode is allowed for tiny low-risk tasks, but do not skip safety checks, changelog, or scope control.

## Final Response

Include:

- Completed `/task-full` ID(s).
- Main changes.
- Files changed.
- Commands run or skipped with reason.
- Technical flow across touched layers.
- TODO/ASSUMPTION/blockers.
- Whether execution plan changed.
- Suggested next subtask.

Update changelog using the concise format from `AGENTS.md`.
