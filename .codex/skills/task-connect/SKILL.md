---
name: task-connect
description: Connect previously built mock UI to real APIs for the Vietnamese learning-path project from commands like "/task-connect M7.1" or "/task-connect M3.4". Use when Codex must preserve the approved UI, replace mock data with API clients/hooks, implement the complete backend API required by the requested subtask when it does not exist, read API contracts/database/user-flow docs, use TanStack Query and React Hook Form plus Zod where appropriate, avoid broad UI redesign, update changelog, and explain the UI-to-API technical flow.
---

# Task Connect Runner

Use this skill after `/task-ui` when the UI is approved enough to connect to real API/data. If the needed API does not exist, implement the full API required by the requested subtask and API contract, then connect the UI to it.

## Command Parsing

Accept:

- `/task-connect M7.1`
- `/task-connect: M7.1`
- `/task-connect M3.4 + M6.2`

Parse subtask IDs in order. Multiple IDs are allowed only when explicitly listed.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read the requested subtask in `docs/09-implementation-plan.md` and the matching milestone file in `docs/implementation/` (for example `M3.4` -> `docs/implementation/M3.md`).
3. If present, read `.codex/plans/codex-execution-plan.md`.
4. Read UI/API docs:
   - `docs/08-ui-pages-and-components.md`
   - `docs/11-ui-design-system.md`
   - `docs/ui-references/approved-patterns.md` if present and relevant.
   - `docs/05-api-contract.md`
   - the matching file in `docs/api/` for the endpoint/domain.
   - `docs/02-user-flows.md`
5. Read database docs when the endpoint does not exist, API behavior changes, or data shape is unclear:
   - `docs/04-database-model.md`
   - the matching file in `docs/database/` for the model/domain.
   - `docs/10-seed-data-and-test-cases.md` if seed/test data is affected.
6. Inspect the UI files created by `/task-ui`.
7. Inspect existing API client/hook patterns and backend module/controller/service patterns.
8. Give a short plan: mock data to replace, full API endpoints/services to implement or use, backend files, frontend hooks/files, docs updates, checks.

## Scope Rules

- If there is no existing UI/mock UI for the requested subtask, stop before editing files and suggest `/task-ui <ID>` first or `/task-full <ID>` if the owner wants the full feature in one pass.
- Preserve the approved UI layout and visual style.
- Preserve the approved UI tokens and responsive behavior from `/task-ui`.
- Replace mock data with API client/hooks.
- Do not do broad visual redesign or polish unless needed to handle real states.
- If the needed API endpoint does not exist, implement the complete backend API required by the requested subtask and `docs/05-api-contract.md` plus the matching `docs/api/` file.
- If the API contract is missing or incomplete, update `docs/05-api-contract.md` and/or the matching `docs/api/` file with the implemented contract.
- Backend work must fully satisfy the requested subtask's API scope, but must not expand into unrelated feature work.
- Database schema changes are allowed only when required by the subtask/docs; update `docs/04-database-model.md`, the matching `docs/database/` file, and migrations when that happens.
- If required backend work is too broad or crosses multiple subtasks, stop and explain the split instead of silently expanding scope.

## Connection Rules

- Use TanStack Query for server state.
- Use mutation invalidation where relevant.
- Forms use React Hook Form + Zod if validation is present.
- Remove or isolate mock data so it cannot be confused with production data.
- Keep loading, empty, error, and disabled states.
- Map API response types carefully; do not hard-code data that should come from API.
- Backend API should follow NestJS patterns: controller -> DTO/guard/validation -> service -> Prisma/provider.
- Enforce auth/RBAC on the backend, not only in UI.
- Backend still enforces RBAC; UI guard is only UX.

## Verification

Run focused checks:

- Typecheck for touched web/shared/api code.
- Focused API/client tests if available.
- Browser/curl check if practical.
- If a new API endpoint is implemented, verify it with a focused API test or curl when local services allow it.
- If API cannot run locally, state what was checked statically.
- For UI states changed by real data, re-check at least the affected mobile and desktop layouts when practical.

## Final Response

Include:

- Completed `/task-connect` ID(s).
- Which mock data was replaced and which endpoint/hooks are used.
- Which backend API was implemented or changed, if any.
- Any blocker or assumption.
- Files changed.
- Commands run or skipped with reason.
- Technical flow: component -> hook/API client -> API endpoint -> controller/service/database -> state/render.
- Suggested next action or subtask.

Update changelog using the concise format from `AGENTS.md`.
