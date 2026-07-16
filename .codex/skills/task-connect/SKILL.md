---
name: task-connect
description: Connect or plan connection of previously built mock UI to real APIs for the Vietnamese learning-path project from commands like "/task-connect M7.1", "/task-connect M3.4", or "/task-connect plan M3.4". Use when Codex must preserve the approved UI, replace mock data with API clients/hooks, implement the complete backend API required by the requested subtask when it does not exist, or produce an approval-gated connection plan first when the command contains "plan"; read API contracts/database/user-flow docs, use TanStack Query and React Hook Form plus Zod where appropriate, avoid broad UI redesign, and explain the UI-to-API technical flow.
---

# Task Connect Runner

Use this skill after `/task-ui` when the UI is approved enough to connect to real API/data. If the needed API does not exist, implement the full API required by the requested subtask and API contract, then connect the UI to it.

## Command Parsing

Accept:

- `/task-connect M7.1`
- `/task-connect: M7.1`
- `/task-connect plan M7.1`
- `/task-connect plan: M7.1`
- `/task-connect screenshot M7.1`
- `/task-connect plan screenshot M7.1`
- `/task-connect M3.4 + M6.2`

Parse subtask IDs in order. If `plan` appears after the command and before the task IDs, enable plan mode. Multiple IDs are allowed only when explicitly listed.

If `screenshot` appears after the command, enable screenshot mode for UI states only because the owner explicitly requested it. Per owner preference, do not run browser checks, Playwright UI, screenshots, or real interaction checks by default. Without the `screenshot` keyword or an explicit browser-check request, do not create/save screenshots and do not run browser/Playwright UI checks; use proportional static/focused code/API checks instead.

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
   - `docs/14-source-code-structure.md`
   - `docs/ui-references/code-patterns.md` routing index and matching file/section in `docs/ui-references/code-patterns/` when connection work touches form validation/submission, modal flow, detail grids, action controls, upload previews, badge/status UI, or loading/empty/error states.
   - `docs/ui-references/approved-patterns.md` if present and relevant.
   - `docs/05-api-contract.md`
   - the matching file in `docs/api/` for the endpoint/domain.
   - `docs/02-user-flows.md`
7. Read database docs when the endpoint does not exist, API behavior changes, or data shape is unclear:
   - `docs/04-database-model.md`
   - the matching file in `docs/database/` for the model/domain.
   - `docs/10-seed-data-and-test-cases.md` if seed/test data is affected.
8. Read `docs/12-performance-and-observability.md` when the connection adds list/search/cache/mutation-heavy UI, new database query, worker/job, AI call, or latency-sensitive endpoint.
9. Read `docs/13-seo-and-content-discovery.md` when connecting public/indexable pages or adding API/database fields used for SEO such as slug, title, description, cover image, published status, sitemap data, canonical, Open Graph, or structured data.
10. Inspect the UI files created by `/task-ui`.
11. Inspect existing API client/hook patterns and backend module/controller/service patterns.
12. Decide source placement and reuse before editing: feature API hook/client, shared components, backend controller/service/DTO/select/serializer/utils/types, and alias imports.
13. Give a short plan: subtask mode, mock data to replace, full API endpoints/services to implement or use, backend files/layers, frontend hooks/files/layers, reusable patterns, SEO/docs updates if relevant, checks.

In plan mode, stop after this plan and wait for approval.

## Scope Rules

- Best fit is `Mode: UI + API`. If mode is `API only`, use `/task-full <ID>` instead. If mode is `UI only`, there is no API to connect.
- If there is no existing UI/mock UI for the requested subtask, stop before editing files and suggest `/task-ui <ID>` first or `/task-full <ID>` if the owner wants the full feature in one pass.
- Treat any owner request to "ghép API", "nối API", "connect API", or `/task-connect` after UI feedback as confirmation that the current UI layout, fields, copy, and flow are approved.
- Preserve the approved UI layout and visual style.
- Preserve the approved UI fields, field order, labels, placeholders, validation UX, and screen flow. Do not add, remove, reorder, rename, or hide UI fields just to match an existing DTO/API/database shape.
- Preserve the approved UI tokens and responsive behavior from `/task-ui`.
- Replace mock data with API client/hooks.
- Do not do broad visual redesign or polish unless needed to handle real states.
- If the approved UI and existing API contract/database schema do not match, adapt the backend/API contract/database or add a clearly documented payload mapping. Do not force the approved UI to fit the old API unless the owner explicitly asks to change the UI.
- If the needed API endpoint does not exist, implement the complete backend API required by the requested subtask and `docs/05-api-contract.md` plus the matching `docs/api/` file.
- Every visible, interactive UI feature in the approved screen is part of the connection contract. Implement the matching backend API/storage behavior in the same task, or explicitly disable/hide/mark that control as unavailable when it is outside scope; do not leave fake client-only success, fake upload, fake delete/restore, or local-only persistence in a production-connected flow.
- If the API contract is missing or incomplete, update `docs/05-api-contract.md` and/or the matching `docs/api/` file with the implemented contract.
- Backend work must fully satisfy the requested subtask's API scope, but must not expand into unrelated feature work.
- Database schema changes are allowed only when required by the subtask/docs; update `docs/04-database-model.md`, the matching `docs/database/` file, and migrations when that happens.
- If new backend/frontend module paths, feature status, or dependencies change, update `.codex/context/code-index.md`, `docs/implementation/feature-coverage-matrix.md`, or `docs/implementation/dependency-graph.md` when useful.
- If required backend work is too broad or crosses multiple subtasks, stop and explain the split instead of silently expanding scope.

## Connection Rules

- Use TanStack Query for server state.
- Use mutation invalidation where relevant.
- Use pending state immediately for mutations; use optimistic UI only when rollback is safe and not payment/auth/security-sensitive.
- Preserve production-like interaction when replacing mock data with APIs. Do not regress working local/mock interactions into static controls; buttons, checkbox/toggle state, tabs, menus, filters, pagination, modals, uploads, and form flows must keep semantic elements, state/handlers, and feedback.
- Preserve the frontend file boundary: one React component implementation per `.tsx` file; avoid barrel/re-export-only files unless framework/tooling requires them.
- In `apps/web`, use absolute alias imports/exports with `@/...` for internal source files. Do not use `../` or `./` between route, feature, component, hook, schema, data, or utility files, except framework-generated files or tool-required relative imports.
- In `apps/api`, use native Node package-import aliases with `#api/...` for internal source files. Do not use `../` or `./` between controller, service, DTO, guard, common provider, config, module, or helper files unless a tool explicitly requires it.
- Follow `docs/14-source-code-structure.md` for both sides of the connection. Do not connect an approved UI by stuffing API calls into deep components or by adding flat backend files beside a module file.
- Debounce search/filter calls and use pagination/infinite query for long lists when relevant.
- Forms use React Hook Form + Zod if validation is present.
- If connecting data changes form behavior, preserve the closest project form pattern routed from `docs/ui-references/code-patterns.md`: realtime validation, direct error wiring to field primitives, stable modal reset/default behavior, and no local `dirtyFields`/`touchedFields` workaround unless the pattern explicitly calls for it.
- Reuse existing shared components, feature hooks, API clients, and approved UI patterns before creating new ones. If API service/hook logic is reusable across screens, place it in a clear shared or feature client layer instead of mixing it into page/components.
- Remove or isolate mock data so it cannot be confused with production data.
- Keep loading, empty, error, and disabled states.
- Map API response types carefully; do not hard-code data that should come from API.
- When an approved UI field has no backend field yet, decide explicitly: store it by extending the API/database when it is part of the feature contract, or keep it as a local/verification-only field with a note when storage is out of scope. Never silently delete it from the UI.
- Backend API should follow NestJS patterns: controller -> DTO/guard/validation -> service -> Prisma/provider.
- Backend module organization should stay layered: keep only `*.module.ts` at module root, with `controllers/`, `services/`, `dto/`, `selectors/`, `serializers/`, `utils/`, and `types/` folders as needed. Do not add new controller/service/helper/select/type files flat beside the module file.
- Backend HTTP errors must go through `apps/api/src/common/errors` helpers/factories so response envelopes and Prisma error mapping stay reusable instead of being rebuilt per module.
- Backend/API/database performance must follow `docs/12-performance-and-observability.md`: pagination, select only needed fields, avoid N+1, enqueue heavy work.
- Public/indexable API data must follow `docs/13-seo-and-content-discovery.md`: only published data, stable slug/canonical data, metadata fields when needed, and no private content exposure.
- Enforce auth/RBAC on the backend, not only in UI.
- Backend still enforces RBAC; UI guard is only UX.

## Verification

Run focused checks:

- Typecheck for touched web/shared/api code.
- Focused API/client tests if available.
- Curl/API check if practical for API/backend behavior; do not run browser checks unless explicitly requested.
- If a new API endpoint is implemented, verify it with a focused API test or curl when local services allow it.
- When backend/API behavior is fixed for a UI the owner is actively testing, verify the actual API origin that the web app calls, usually `localhost:4000`, and restart any stale dev server on that port before saying the UI is ready. Do not rely only on a temporary alternate port if the owner will test against `4000`.
- If API cannot run locally, state what was checked statically.
- For UI states changed by real data, use static/focused checks by default; owner will self-check mobile/desktop layout and interaction.
- Only create or save screenshots when screenshot mode is enabled by the command, for example `/task-connect screenshot M3.4`.
- For data-connected UI, mention whether perceived latency, pending state, cache/invalidation, and list/search performance were checked or skipped.
- For public/indexable UI, mention whether metadata/slug/published/canonical/sitemap impact was handled or not in scope.

## Lean Mode For Small Connection Tasks

For tiny, low-risk connection tasks, optimize for speed.

Allowed reductions:

- Skip full repo lint/build when only one hook/client mapping, endpoint wiring, or small UI state mapping changed.
- Run the smallest useful check: touched package typecheck, focused curl/API check, focused validator, or `git diff --check`.
- If local services are not running and the change is straightforward, use static verification and state that clearly.

Non-negotiable:

- Do not use lean mode when adding/changing auth/RBAC, payment, database/schema/migration, API contract, AI/RAG, worker/queue, storage, notification/realtime, security, or multi-module behavior.
- If the owner writes `fast`, `check nhẹ`, or `sửa nhanh`, use lean verification only when the connection change is low risk; keep the full workflow when connecting auth/session, permissions, payment, database writes, API contracts, or multi-screen data behavior.
- Do not skip backend permission reasoning when real data is connected.
- If broader checks are skipped, state `Not run: <reason>` in the final response.

## Learning Notes

After connecting UI to real API/data, update `docs/learning-notes/` when the flow is useful for future learning.

- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer the matching feature note in `docs/learning-notes/features/`, because `/task-connect` usually creates an end-to-end flow.
- Capture the full path: UI/component -> hook/API client -> endpoint -> controller/service -> database/provider -> response -> UI state.
- Include database/worker/AI/integration only when they are actually involved.
- Merge with existing sections instead of adding duplicate paragraphs.
- Do not copy the final response verbatim.
- Do not update changelog when learning notes change; `/commit` will record the commit's main changes.
- If not updated, mention briefly in the final response.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the connection work or plan is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when implementation or checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/task-connect M3.4` or `/task-connect plan M3.4`. For plan mode, say the plan is ready for approval. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

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
- Suggested next action or subtask: when recommending a roadmap command, include the command, exact `Mode` from the milestone file, and a one-sentence description of what that task does.

Do not update changelog here. Changelog is written only during `/commit`, with one short, coherent entry for the whole commit.
