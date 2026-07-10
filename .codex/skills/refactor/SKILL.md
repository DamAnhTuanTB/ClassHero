---
name: refactor
description: Refactor existing code in the Vietnamese learning-path project from commands like "/refactor M3.4", "/refactor tính năng thanh toán", or "/refactor apps/api auth module". Use when Codex must improve code structure, readability, maintainability, duplication, layering, types, or local architecture without intentionally changing product behavior, API contract, database schema, UI design, or approved stack; read relevant docs/code first, preserve tests and behavior, run proportional checks, and explain the before/after technical flow.
---

# Refactor Runner

Use this skill when the owner wants code refactoring, not a feature behavior change.

## Command Parsing

Accept:

- `/refactor <task id>`
- `/refactor <feature/module description>`
- `/refactor M3.4`
- `/refactor tính năng thanh toán`
- `/refactor apps/api auth module`

If the target code area is unclear, ask one concise question. If the request asks for behavior changes, suggest `/update-feature` instead.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. If a task code is provided, read `docs/09-implementation-plan.md` and the matching `docs/implementation/Mx.md`.
3. Use the `Task Routing Map` in `AGENTS.md` to read only directly relevant docs.
4. If API/database/AI/UI surfaces are touched, read the matching index and domain docs:
   - API: `docs/05-api-contract.md` and matching `docs/api/` file.
   - Database: `docs/04-database-model.md` and matching `docs/database/` file.
   - UI: `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`.
   - AI/RAG: `docs/06-ai-rag-spec.md`.
5. If the refactor targets performance, latency, cache, query shape, worker throughput, or AI/RAG speed, read `docs/12-performance-and-observability.md`.
6. If the refactor touches public/indexable page structure, metadata, slug, sitemap, robots, canonical, Open Graph or structured data, read `docs/13-seo-and-content-discovery.md`.
7. Inspect current code, tests, call sites, and `git status --short`.
8. Give a short plan: target area, intended refactor, behavior-preservation checks, files likely touched.

## Refactor Rules

- Preserve existing product behavior unless the owner explicitly asks otherwise.
- Do not change API contract, database schema, permission/RBAC, payment behavior, AI/RAG behavior, env names, or UI design as part of refactor.
- Do not change SEO/indexability behavior such as robots, canonical, sitemap or metadata as part of refactor.
- Do not change stack or add new packages unless clearly necessary and approved.
- Keep edits scoped to the requested feature/module/task.
- Do not rename public exports/routes/files broadly unless all call sites are updated and the benefit is clear.
- Prefer existing project patterns over introducing new abstractions.
- Add an abstraction only when it removes real duplication or clarifies a repeated flow.
- If a refactor reveals a bug, stop and explain whether to fix it now or use `/fix bug`.
- If a refactor requires behavior/schema/API changes, stop and suggest `/update-feature`.

## Common Refactor Targets

- Backend: controller -> DTO/guard/validation -> service -> Prisma/provider flow.
- Back-end module reorganization: keep module roots clean with `*.module.ts` only; group controller/service/DTO/select/serializer/helper/type files into responsibility folders instead of leaving a flat file list.
- Back-end error handling: move repeated HTTP exception bodies and Prisma error checks into reusable helpers under `apps/api/src/common/errors`; domain utils may keep message-specific wrappers.
- Front-end: page -> component -> hook/client/state flow.
- Shared: schemas/types/constants reused by web/API.
- Worker/AI: queue job -> worker -> provider -> DB/status/cache flow.
- Tests: reduce duplication and align tests with refactored units.

## Verification

Run checks proportional to risk:

- Typecheck for touched package(s).
- Focused tests if existing tests cover the area.
- Lint/build when shared/public surfaces changed.
- Browser/curl smoke check if route/API behavior could be affected.
- For docs-only refactor notes, `git diff --check` may be enough.

Do not update changelog in this workflow. Changelog is written only during `/commit` for the commit being created.

## Lean Mode For Small Refactors

For tiny, low-risk refactors, optimize for speed.

Allowed reductions:

- Skip full repo lint/build/test when the refactor is isolated and behavior-neutral.
- Run the smallest useful check: focused typecheck, existing focused test, `git diff --check`, or static inspection.
- For docs-only or mechanical cleanup, `Not run: docs-only` or `Not run: mechanical cleanup only` is acceptable.

Non-negotiable:

- Do not use lean mode for public API changes, database/schema, auth/RBAC, payment, AI/RAG, worker/queue, security, shared package contracts, or broad module moves.
- Do not change behavior under the label of refactor.
- If broader checks are skipped, state `Not run: <reason>` in the final response.

## Learning Notes

After refactor work, update `docs/learning-notes/` only when the refactor teaches a reusable structure or pattern.

- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer updating the affected feature note if the refactor is tied to one product flow.
- Use `docs/learning-notes/foundation/` for reusable architecture patterns, module boundaries, database access, worker/provider patterns, or shared typing.
- Add before/after flow only when it helps the owner understand the system better.
- Do not document purely mechanical renames or tiny cleanup.
- Do not copy the final response verbatim.
- Do not update changelog when learning notes change; `/commit` will record the commit's main changes.
- If not updated, mention briefly in the final response.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the refactor is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when implementation or checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/refactor M3.4` or the refactored module. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Include:

- Refactored area.
- What changed structurally.
- Confirmed behavior/API/schema/UI design stayed the same, or state any intentional exception.
- `Giải thích kỹ thuật dễ hiểu`:
  - Mục tiêu kỹ thuật của refactor.
  - Luồng code trước refactor và luồng code sau refactor.
  - Kỹ thuật đã dùng: tách lớp, gom helper, typing, module boundary, component composition, provider abstraction, etc.; explain why each matters.
  - Vì sao refactor này giữ nguyên behavior nhưng giúp code dễ đọc/dễ bảo trì hơn.
  - File quan trọng: entry point, logic chính, helper/shared file, test liên quan.
  - Bạn nên hiểu gì sau refactor này: 2-4 ý kiến thức rút ra.
- Whether learning notes changed.
- Checks run or skipped with reason.
- Files touched.
- Risks/TODO/ASSUMPTION.
