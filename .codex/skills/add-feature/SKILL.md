---
name: add-feature
description: Add a new feature to the Vietnamese learning-path project from commands like "/add-feature thêm tính năng abc" or "thêm mới tính năng ...". Use when Codex must evaluate whether the feature belongs in MVP, update product/user-flow/implementation/API/database/UI/AI docs and roadmap task codes as a docs/planning-only step by default, avoid changing the approved stack, split large work into roadmap subtasks, avoid production code changes unless the owner explicitly asks to implement now, run docs checks, and suggest the next implementation task command with task code when possible.
---

# Add Feature Runner

Use this skill when the owner asks to add a feature that is not already in the roadmap/docs.

## Command Parsing

Accept:

- `/add-feature <feature description>`
- `/add feature <feature description>`
- `thêm tính năng <description>`
- `thêm mới tính năng <description>`

If the description is too vague to define scope, ask one concise question.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read `docs/01-product-scope.md` to check MVP fit.
3. Read `docs/02-user-flows.md` to understand affected roles/flows.
4. Read `docs/09-implementation-plan.md` and relevant `docs/implementation/Mx.md` files.
5. Read `docs/implementation/dependency-graph.md` and `docs/implementation/feature-coverage-matrix.md` if they exist.
6. Read affected domain docs:
   - UI: `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`.
   - API: `docs/05-api-contract.md` and matching/new `docs/api/` file.
   - Database: `docs/04-database-model.md` and matching/new `docs/database/` file.
   - AI/RAG: `docs/06-ai-rag-spec.md`.
   - Env/integration: `docs/07-integration-and-env.md`.
   - Performance/observability: `docs/12-performance-and-observability.md` if the feature adds or changes list/search/cache, latency-sensitive flow, database query, worker/job, AI call, or observability behavior.
   - SEO/public discovery: `docs/13-seo-and-content-discovery.md` if the feature adds public/indexable pages or metadata/search-discovery behavior.
7. Inspect existing code only enough to understand existing boundaries; do not plan production edits unless the owner explicitly asks to implement now.
8. Inspect `git status --short`.
9. Give a short plan: MVP decision, docs to add/update, task code to add/reuse, and checks.

## Scope Guard

- This skill is docs/planning-only by default.
- Do not edit production code unless the owner explicitly says to implement in the same request.
- If the feature is outside MVP, do not code it silently. Explain the conflict and ask whether to update MVP scope/docs.
- If approved as MVP, update product scope and implementation docs first.
- Do not introduce a new stack/provider/library unless already approved in docs or explicitly approved by the owner.
- Prefer adding a new subtask to `docs/implementation/Mx.md` when the feature is substantial.
- For small in-scope additions, update the existing task/docs and suggest the next implementation command.
- If the feature crosses many domains, split into `/task-ui`, `/task-connect`, or `/task-full` follow-up subtasks.

## Task Code Rules

If the new feature needs roadmap tracking:

- Add a new task code in the most relevant `docs/implementation/Mx.md`, for example append `M8.5` under `M8` for a new payment feature.
- Pick the milestone by domain, not by where the prompt happened to be asked.
- Use the next available task number in that milestone; do not insert in the middle unless the owner explicitly wants that.
- Update `docs/09-implementation-plan.md` if the new task must appear in recommended order or changes dependencies.
- Update `docs/implementation/feature-coverage-matrix.md` if the feature adds or changes DB/API/UI/worker/test coverage.
- Update `docs/implementation/dependency-graph.md` if dependencies change.
- Add a decision record in `docs/decisions/` only if the feature changes long-term scope/architecture/workflow.
- If the feature is tiny and fully covered by an existing task, update that task's scope instead of creating a new code.
- If `.codex/plans/codex-execution-plan.md` exists, update it when the new task affects near-term next steps/TODOs.
- Mention in the final response which task code was added or reused.

## Documentation Updates

When approved and clear:

- Product: update `docs/01-product-scope.md`.
- Flow: update `docs/02-user-flows.md`.
- UI: update `docs/08-ui-pages-and-components.md` and `docs/11-ui-design-system.md` only if the feature changes planned UI/screen rules.
- API: update `docs/05-api-contract.md` and matching `docs/api/` file if the feature needs API.
- Database: update `docs/04-database-model.md` and matching `docs/database/` file if the feature needs data changes.
- AI/RAG/env: update relevant docs only if the feature needs them.
- Performance/observability: update `docs/12-performance-and-observability.md` only if the feature changes performance budgets, cache/index/query/job/AI latency, or observability standards.
- SEO/public discovery: update `docs/13-seo-and-content-discovery.md` only if the feature changes public indexability, metadata, sitemap, robots, canonical, structured data or search-discovery behavior.
- Roadmap: update `docs/09-implementation-plan.md` only for order/dependency changes; update `docs/implementation/Mx.md` for subtask scope.
- Coverage/dependencies: update helper docs when the feature changes coverage or dependency graph.

## Verification

Run docs checks such as `git diff --check`. If the owner explicitly requested implementation in the same request, run code checks proportional to changed code.

Do not update changelog in this workflow. Changelog is written only during `/commit` for the commit being created.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the feature update or plan is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when docs/code checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/add-feature <short feature>`. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Include:

- Whether the feature is inside MVP or treated as an approved scope change.
- Docs added/updated.
- Task code added/reused, if any.
- No production code changed, unless explicitly requested.
- Planned technical flow for the future implementation.
- Checks run or skipped with reason.
- Remaining TODO/ASSUMPTION.
- Suggested next task command with task code when possible, for example `/task-ui Mx.y`, `/task-connect Mx.y`, or `/task-full Mx.y`; include the task `Mode` and a one-sentence description of what that implementation task does.
