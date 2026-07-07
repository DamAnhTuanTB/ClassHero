---
name: task-ui
description: Run UI-first roadmap subtasks for the Vietnamese learning-path project from commands like "/task-ui M7.1" or "/task-ui M3.4". Use when Codex must implement only the front-end UI for a task using clear mock data first, read the project UI design system and relevant docs, avoid backend/database/API implementation, build mobile-first layouts that also work on tablet/iPad and laptop/desktop, keep mock data easy to remove, update changelog, and suggest the matching "/task-connect" command after completion.
---

# Task UI Runner

Use this skill when the owner wants UI first, before API integration.

## Command Parsing

Accept:

- `/task-ui M7.1`
- `/task-ui: M7.1`
- `/task-ui M3.4 + M6.2`

Parse subtask IDs in order. Multiple IDs are allowed only when the user explicitly lists them.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read the requested subtask in `docs/09-implementation-plan.md`.
3. If present, read `.codex/plans/codex-execution-plan.md`.
4. Read UI docs:
   - `docs/11-ui-design-system.md`
   - `docs/08-ui-pages-and-components.md`
   - `docs/ui-references/reference-notes.md` if relevant.
   - `docs/ui-references/approved-patterns.md` if present and relevant.
5. Read `docs/02-user-flows.md` for the affected role/flow.
6. Read `docs/05-api-contract.md` only to understand expected data shape; do not connect API.
7. Inspect existing web code and component patterns.
8. Give a short plan: screen/component, mock data location, likely files, responsive checks, and commands.

## Scope Rules

- If the requested subtask has no UI surface, stop before editing files, explain that `/task-ui` is not the right mode, and suggest `/task-full <ID>` or the correct next command.
- Only implement front-end UI and mock data.
- Do not edit backend, database, Prisma, API services, workers, payment, storage, or AI logic.
- Do not connect real API calls.
- Do not add features outside MVP or outside the requested subtask.
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

## Final Response

Include:

- Completed `/task-ui` ID(s).
- What UI was built and where mock data lives.
- Responsive checks done or skipped.
- Screenshot paths if screenshots were created.
- Files changed.
- Commands run or skipped with reason.
- Technical UI flow: page/component -> mock data -> state/render.
- Suggested next command: `/task-connect Mx.y`.

Update changelog using the concise format from `AGENTS.md`.
