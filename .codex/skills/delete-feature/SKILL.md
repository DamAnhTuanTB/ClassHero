---
name: delete-feature
description: Delete or remove an existing feature from the Vietnamese learning-path project from commands like "/delete-feature xóa tính năng abc" or "bỏ tính năng ...". Use when Codex must identify the feature, assess product/API/database/UI/AI impact, update source-of-truth docs and roadmap task codes as a docs/planning-only step by default, avoid production code/data deletion unless the owner explicitly asks to implement removal now, avoid destructive data loss without confirmation, run docs checks, update changelog, explain what is removed from scope, and suggest the next cleanup task command with task code when possible.
---

# Delete Feature Runner

Use this skill when the owner wants to remove an existing feature or stop supporting a behavior.

## Command Parsing

Accept:

- `/delete-feature <feature description>`
- `/delete feature <feature description>`
- `xóa tính năng <description>`
- `bỏ tính năng <description>`
- `không làm tính năng <description> nữa`

If the feature or removal depth is unclear, ask one concise question.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read `docs/01-product-scope.md` and `docs/02-user-flows.md`.
3. Read `docs/09-implementation-plan.md` and relevant `docs/implementation/Mx.md` files.
4. Read `docs/implementation/dependency-graph.md` and `docs/implementation/feature-coverage-matrix.md` if they exist.
5. Read affected domain docs:
   - UI: `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`.
   - API: `docs/05-api-contract.md` and matching `docs/api/` file.
   - Database: `docs/04-database-model.md` and matching `docs/database/` file.
   - AI/RAG: `docs/06-ai-rag-spec.md`.
   - Env/integration: `docs/07-integration-and-env.md`.
   - Performance/observability: `docs/12-performance-and-observability.md` if removing the feature changes list/search/cache, latency-sensitive flow, database query, worker/job, AI call, or observability behavior.
   - SEO/public discovery: `docs/13-seo-and-content-discovery.md` if removing a public/indexable feature, route, metadata, sitemap entry, robots rule, canonical or structured data.
6. Search existing docs and code only enough to understand feature boundaries; do not plan production edits unless the owner explicitly asks to implement removal now.
7. Inspect `git status --short`.
8. Give a short plan: remove vs deprecate in docs, task codes affected, current-version impact, and checks.

## Safety Rules

- This skill is docs/planning-only by default.
- Do not edit production code or delete data unless the owner explicitly says to implement removal in the same request.
- Confirm destructive data deletion or irreversible migration before doing it.
- Prefer documenting removal/deprecation over dropping data immediately unless the owner explicitly approves.
- Do not remove shared infrastructure just because one feature stops using it.
- Update docs to remove or mark the feature as out of scope.
- If removing a public API from scope, update API docs and suggest follow-up implementation cleanup.
- If removing database tables/fields from scope, update database docs and note future migration risk.
- If removing AI/payment/auth/security behavior, use extra caution and run broader checks where practical.

## Documentation Updates

When scope is clear:

- Product/flow: remove feature from scope and user flows.
- UI: update UI docs to remove current-version screens/components or mark them out of scope.
- API: remove/deprecate endpoint docs in matching `docs/api/` file.
- Database: remove/deprecate schema docs only with a safe future migration note.
- AI/RAG/env: remove or mark related docs out of scope if no longer used.
- Performance/observability: update performance docs if removal changes budgets, cache/index/query/job/AI latency, or observability standards.
- SEO/public discovery: update SEO docs if public indexability, sitemap, robots, canonical, structured data or public discovery behavior changes.
- Roadmap: update `docs/implementation/Mx.md`; update `docs/09-implementation-plan.md` only if order/dependencies change.
- Coverage/dependencies: update `docs/implementation/feature-coverage-matrix.md` and `docs/implementation/dependency-graph.md` when coverage/status/dependency changes.
- Decision log: add/update `docs/decisions/` only when removal is an important long-term product/architecture decision.

## Task Code Rules

If the removed feature has roadmap/subtask codes:

- Prefer marking the task as removed/out of scope in the relevant `docs/implementation/Mx.md` instead of renumbering other tasks.
- Remove the task from `docs/09-implementation-plan.md` recommended order only if it should no longer be executed.
- If later tasks depend on the removed task, update dependencies and note the replacement path or removed dependency.
- If feature coverage changes, update `docs/implementation/feature-coverage-matrix.md`.
- Do not delete historical context that explains why a task disappeared; add a short note when useful.
- If `.codex/plans/codex-execution-plan.md` exists, update it when the removal affects near-term next steps/TODOs.
- Mention in the final response which task code was removed, marked out of scope, or left unchanged.

## Verification

Run checks proportional to removal risk:

- Docs-only by default: `git diff --check`.
- If the owner explicitly requested implementation cleanup in the same request, run code checks proportional to changed code.

Update changelog after file changes.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the feature removal/deprecation update is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when docs/code checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/delete-feature <short feature>`. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Include:

- Feature removed or deprecated.
- Docs updated.
- Task code removed/marked out of scope/left unchanged.
- No production code/data removed, unless explicitly requested.
- Planned cleanup flow: what path should be removed later and what replaces it, if anything.
- Checks run or skipped with reason.
- Migration/data risks or TODO.
- Suggested next cleanup command with task code when possible, for example `/task-full Mx.y` or `/refactor Mx.y`; include the task `Mode` and a one-sentence description of what that cleanup task does.
