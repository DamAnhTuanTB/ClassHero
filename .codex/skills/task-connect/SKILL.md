---
name: task-connect
description: Connect or plan connection of previously built mock UI to real APIs for the Vietnamese learning-path project from commands like "/task-connect M7.1", "/task-connect M3.4", or "/task-connect plan M3.4". Use when Codex must preserve the approved UI, replace mock data with API clients/hooks, implement the complete backend API required by the requested subtask when it does not exist, or produce an approval-gated connection plan first when the command contains "plan"; read API contracts/database/user-flow docs, use TanStack Query and React Hook Form plus Zod where appropriate, avoid broad UI redesign, update changelog after implementation, and explain the UI-to-API technical flow.
---

# Task Connect Runner

Use this skill after `/task-ui` when the UI is approved enough to connect to real API/data. If the needed API does not exist, implement the full API required by the requested subtask and API contract, then connect the UI to it.

## Command Parsing

Accept:

- `/task-connect M7.1`
- `/task-connect: M7.1`
- `/task-connect plan M7.1`
- `/task-connect plan: M7.1`
- `/task-connect M3.4 + M6.2`

Parse subtask IDs in order. If `plan` appears after the command and before the task IDs, enable plan mode. Multiple IDs are allowed only when explicitly listed.

## Plan Mode

When the command contains `plan`, do approval-gated connection planning only.

- Read the same startup docs needed to make a reliable connection plan.
- Inspect existing UI/API/backend code enough to identify likely files and risks.
- Do not edit files, implement endpoints, replace mock data, update changelog, or stage/commit.
- Output a plan with:
  - subtask ID, mode, UI-to-API goal,
  - docs/code inspected,
  - mock data to replace,
  - API endpoints/services/hooks likely to add or reuse,
  - database/schema/docs updates expected if API is missing,
  - expected technical flow from component to database/provider and back,
  - verification commands expected,
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
5. If useful for orientation, read `.codex/context/current-context.md`, `.codex/context/code-index.md`, `docs/implementation/dependency-graph.md`, and `docs/implementation/feature-coverage-matrix.md`.
6. Read UI/API docs:
   - `docs/08-ui-pages-and-components.md`
   - `docs/11-ui-design-system.md`
   - `docs/ui-references/approved-patterns.md` if present and relevant.
   - `docs/05-api-contract.md`
   - the matching file in `docs/api/` for the endpoint/domain.
   - `docs/02-user-flows.md`
7. Read database docs when the endpoint does not exist, API behavior changes, or data shape is unclear:
   - `docs/04-database-model.md`
   - the matching file in `docs/database/` for the model/domain.
   - `docs/10-seed-data-and-test-cases.md` if seed/test data is affected.
8. Inspect the UI files created by `/task-ui`.
9. Inspect existing API client/hook patterns and backend module/controller/service patterns.
10. Give a short plan: subtask mode, mock data to replace, full API endpoints/services to implement or use, backend files, frontend hooks/files, docs updates, checks.

In plan mode, stop after this plan and wait for approval.

## Scope Rules

- Best fit is `Mode: UI + API`. If mode is `API only`, use `/task-full <ID>` instead. If mode is `UI only`, there is no API to connect.
- If there is no existing UI/mock UI for the requested subtask, stop before editing files and suggest `/task-ui <ID>` first or `/task-full <ID>` if the owner wants the full feature in one pass.
- Preserve the approved UI layout and visual style.
- Preserve the approved UI tokens and responsive behavior from `/task-ui`.
- Replace mock data with API client/hooks.
- Do not do broad visual redesign or polish unless needed to handle real states.
- If the needed API endpoint does not exist, implement the complete backend API required by the requested subtask and `docs/05-api-contract.md` plus the matching `docs/api/` file.
- If the API contract is missing or incomplete, update `docs/05-api-contract.md` and/or the matching `docs/api/` file with the implemented contract.
- Backend work must fully satisfy the requested subtask's API scope, but must not expand into unrelated feature work.
- Database schema changes are allowed only when required by the subtask/docs; update `docs/04-database-model.md`, the matching `docs/database/` file, and migrations when that happens.
- If new backend/frontend module paths, feature status, or dependencies change, update `.codex/context/code-index.md`, `docs/implementation/feature-coverage-matrix.md`, or `docs/implementation/dependency-graph.md` when useful.
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

## Lean Mode For Small Connection Tasks

For tiny, low-risk connection tasks, optimize for speed.

Allowed reductions:

- Skip full repo lint/build when only one hook/client mapping, endpoint wiring, or small UI state mapping changed.
- Run the smallest useful check: touched package typecheck, focused curl/API check, focused validator, or `git diff --check`.
- If local services are not running and the change is straightforward, use static verification and state that clearly.

Non-negotiable:

- Do not use lean mode when adding/changing auth/RBAC, payment, database/schema/migration, API contract, AI/RAG, worker/queue, storage, notification/realtime, security, or multi-module behavior.
- Do not skip backend permission reasoning when real data is connected.
- If broader checks are skipped, state `Not run: <reason>` in changelog and final response.

## Learning Notes

After connecting UI to real API/data, update `docs/learning-notes/` when the flow is useful for future learning.

- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer the matching feature note in `docs/learning-notes/features/`, because `/task-connect` usually creates an end-to-end flow.
- Capture the full path: UI/component -> hook/API client -> endpoint -> controller/service -> database/provider -> response -> UI state.
- Include database/worker/AI/integration only when they are actually involved.
- Merge with existing sections instead of adding duplicate paragraphs.
- Do not copy the final response verbatim.
- Update changelog if learning notes changed.
- If not updated, mention briefly in the final response.

## Final Response

Include:

- Completed `/task-connect` ID(s).
- Which mock data was replaced and which endpoint/hooks are used.
- Which backend API was implemented or changed, if any.
- Any blocker or assumption.
- Files changed.
- Commands run or skipped with reason.
- `Giải thích kỹ thuật dễ hiểu`:
  - Mục tiêu kỹ thuật: UI nào được nối với dữ liệu thật và API nào được thêm/sửa.
  - Luồng code: component -> hook/API client -> API endpoint -> controller -> DTO/guard/validation -> service -> Prisma/provider -> database/external service -> response -> cache/state/render.
  - Kỹ thuật đã dùng: TanStack Query/mutation invalidation, React Hook Form/Zod, NestJS controller-service, Prisma, RBAC hoặc provider nếu có; giải thích vai trò từng phần.
  - Vì sao làm vậy: lý do giữ UI đã duyệt, thay mock bằng API, và backend vẫn enforce quyền.
  - File quan trọng: UI entry, hook/client, controller/service, DTO/schema/docs.
  - Bạn nên hiểu gì sau task này: 2-4 ý về cách frontend và backend nối với nhau.
- Whether learning notes changed.
- Suggested next action or subtask.

Update changelog using the concise format from `AGENTS.md`.
