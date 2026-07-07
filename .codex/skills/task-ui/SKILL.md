---
name: task-ui
description: Run or plan UI-first roadmap subtasks for the Vietnamese learning-path project from commands like "/task-ui M7.1", "/task-ui M3.4", or "/task-ui plan M3.5". Use when Codex must implement only the front-end UI for a task using clear mock data first, or produce an approval-gated UI plan first when the command contains "plan"; read the project UI design system and relevant docs, avoid backend/database/API implementation, build mobile-first layouts that also work on tablet/iPad and laptop/desktop, keep mock data easy to remove, update changelog after implementation, and suggest the matching "/task-connect" command after completion.
---

# Task UI Runner

Use this skill when the owner wants UI first, before API integration.

## Command Parsing

Accept:

- `/task-ui M7.1`
- `/task-ui: M7.1`
- `/task-ui plan M7.1`
- `/task-ui plan: M7.1`
- `/task-ui M3.4 + M6.2`

Parse subtask IDs in order. If `plan` appears after the command and before the task IDs, enable plan mode. Multiple IDs are allowed only when the user explicitly lists them.

## Plan Mode

When the command contains `plan`, do approval-gated UI planning only.

- Read the same startup docs needed to make a reliable UI plan.
- Inspect existing web code/component patterns enough to identify likely files and risks.
- Do not edit files, create screenshots, run implementation, update changelog, or stage/commit.
- Output a plan with:
  - subtask ID, mode, screen/component goal,
  - docs/code inspected,
  - route/component/mock data files likely to change,
  - proposed layout, states, responsive approach, and mock data shape,
  - what will not be touched, especially backend/API/database/worker,
  - expected UI checks/screenshots,
  - risks, blockers, assumptions, and questions.
- End by asking the owner to approve or revise the plan.
- If the owner later says `/do`, "ok", "làm đi", "triển khai đi", or similar, continue from the approved plan, re-check `git status --short`, re-read any docs/code that may have changed, then implement.
- If the owner revises the plan, update the plan and wait again before implementing.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read the requested subtask in `docs/09-implementation-plan.md` and the matching milestone file in `docs/implementation/` (for example `M3.4` -> `docs/implementation/M3.md`).
3. Read the subtask `Mode`.
4. If present, read `.codex/plans/codex-execution-plan.md`.
5. If useful for orientation, read `.codex/context/current-context.md`, `.codex/context/code-index.md`, and `docs/implementation/feature-coverage-matrix.md`.
6. Read UI docs:
   - `docs/11-ui-design-system.md`
   - `docs/08-ui-pages-and-components.md`
   - `docs/ui-references/reference-notes.md` if relevant.
   - `docs/ui-references/approved-patterns.md` if present and relevant.
7. Read `docs/02-user-flows.md` for the affected role/flow.
8. Read `docs/05-api-contract.md` and the matching `docs/api/` file only to understand expected data shape; do not connect API.
9. Inspect existing web code and component patterns.
10. Give a short plan: subtask mode, screen/component, mock data location, likely files, responsive checks, and commands.

In plan mode, stop after this plan and wait for approval.

## Scope Rules

- Continue only when `Mode` is `UI only` or `UI + API`.
- If the requested subtask has no UI surface or has another mode, stop before editing files, explain that `/task-ui` is not the right mode, and suggest `/task-full <ID>` or the correct next command.
- Only implement front-end UI and mock data.
- Do not edit backend, database, Prisma, API services, workers, payment, storage, or AI logic.
- Do not connect real API calls.
- Do not add features outside MVP or outside the requested subtask.
- If new routes/components/features are created, update `.codex/context/code-index.md` or `docs/implementation/feature-coverage-matrix.md` only when that helps future tasks find or track the UI.
- If required API/backend does not exist, keep UI mock-only and note `/task-connect` may be blocked later.
- Use the approved stack: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query only if useful for local UI state mock, Zustand only for small UI state.
- Mock data must be obvious, typed where practical, and easy to delete or replace when `/task-connect` runs.

## UI Requirements

- Follow `docs/11-ui-design-system.md`.
- Use the default UI tokens from `docs/11-ui-design-system.md`; do not invent a new palette per screen.
- Mobile-first, with tablet/iPad and laptop/desktop support.
- Include loading, empty, error, and disabled states when the screen has data/action.
- Use shadcn/ui primitives when available.
- Use `lucide-react` icons when icons are needed.
- Do not create desktop-only layouts.
- If app can run, check at least mobile and desktop; check tablet/iPad for complex layouts.

## Owner Approval Memory

When the owner says the UI is approved, for example "ưng rồi", "ok rồi", "đúng ý rồi", "chốt UI này", or "giữ style này":

- Add a concise entry to `docs/ui-references/approved-patterns.md`.
- Record context, approved layout/style choices, things to avoid, reusable screens/flows, and screenshot/file evidence if available.
- Update `docs/11-ui-design-system.md` only when the owner approves a broad rule that should apply across many screens.
- Update changelog.

## Verification

Run checks proportional to risk:

- Prefer `pnpm --filter @learning-path/web typecheck` or `pnpm typecheck` if web types are affected.
- Run lint/build only when useful and not excessive.
- If app can run, provide URL/route and mention responsive viewport checks or screenshots.
- When screenshots are useful for owner review, save them under `.codex/screenshots/<subtask-or-screen>-<viewport>.png`.
- For tiny docs/wording changes, `Not run: docs-only` is acceptable.

## Lean Mode For Small UI Tasks

For tiny, low-risk UI tasks, optimize for speed.

Allowed reductions:

- Skip full repo lint/build when only a small component, copy, spacing, mock data, or docs changed.
- Run only a focused web typecheck, `git diff --check`, or a quick visual/manual check when enough.
- Skip screenshot generation if the change is trivial or the app is not already running.

Non-negotiable:

- Keep mobile-first and no-overlap checks in mind even when manual.
- Do not use lean mode for broad layouts, auth/payment flows, data-connected UI, route guards, or multi-screen changes.
- If larger checks/screenshots are skipped, state `Not run: <reason>` in changelog and final response.

## Learning Notes

After UI work, update `docs/learning-notes/` only when the UI pattern or screen flow teaches something reusable.

- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer updating the matching feature note in `docs/learning-notes/features/`.
- For UI-only work, update the `Front-end`, `Luồng code end-to-end`, `File quan trọng`, or `Kiến thức cần nhớ` sections rather than creating frontend-only notes.
- Do not copy the final response verbatim.
- Do not duplicate design rules already captured in `docs/11-ui-design-system.md` or `docs/ui-references/approved-patterns.md`; link/summarize instead.
- Update changelog if learning notes changed.
- If not updated, mention briefly in the final response.

## Final Response

Include:

- Completed `/task-ui` ID(s).
- What UI was built and where mock data lives.
- Responsive checks done or skipped.
- Screenshot paths if screenshots were created.
- Files changed.
- Commands run or skipped with reason.
- `Giải thích kỹ thuật dễ hiểu`:
  - Mục tiêu kỹ thuật của UI.
  - Luồng code UI: route/page -> component -> mock data -> local state/form state -> render states.
  - Kỹ thuật UI đã dùng: responsive/mobile-first, component composition, form/state/mock data pattern, loading/empty/error state nếu có.
  - Vì sao làm vậy: cách này giúp UI dễ review, dễ thay mock bằng API ở `/task-connect`.
  - File quan trọng: page/component/mock data/style helper liên quan.
  - Bạn nên hiểu gì sau task này: 2-4 ý về cách màn hình được dựng.
- Whether learning notes changed.
- Suggested next command: `/task-connect Mx.y`.

Update changelog using the concise format from `AGENTS.md`.
