---
name: update-feature
description: Update an existing feature in the Vietnamese learning-path project from commands like "/update-feature đổi thanh toán 12 tháng thành 6 tháng" or "/update-feature tính năng abc bây giờ làm như này". Use when Codex must identify the existing feature, update the right source-of-truth docs and roadmap task codes as a docs/planning-only step by default, keep the approved stack/MVP guardrails, update API/database/UI/AI/implementation docs as needed, avoid production code changes unless the owner explicitly asks to implement now, run docs checks, explain the planned changed technical flow, and suggest the next implementation task command with task code when possible.
---

# Update Feature Runner

Use this skill when the owner changes how an existing feature should work.

## Command Parsing

Accept:

- `/update-feature <change description>`
- `/update feature <change description>`
- `đổi tính năng <feature> thành <new behavior>`
- `sửa logic tính năng <description>`

If the change is too vague to identify the feature or desired behavior, ask one concise question.

## Required Startup

Before editing:

1. Read `AGENTS.md`.
2. Read `docs/01-product-scope.md` and `docs/02-user-flows.md` for product impact.
3. Read `docs/09-implementation-plan.md` and the matching file in `docs/implementation/` if the feature maps to a milestone.
4. Read `docs/implementation/dependency-graph.md` and `docs/implementation/feature-coverage-matrix.md` if they exist.
5. Read source-of-truth docs for affected domains:
   - UI: `docs/08-ui-pages-and-components.md`, `docs/11-ui-design-system.md`.
   - API: `docs/05-api-contract.md` and matching `docs/api/` file.
   - Database: `docs/04-database-model.md` and matching `docs/database/` file.
   - AI/RAG: `docs/06-ai-rag-spec.md`.
   - Env/integration: `docs/07-integration-and-env.md`.
   - Performance/observability: `docs/12-performance-and-observability.md` if list/search/cache, latency-sensitive flow, database query, worker/job, AI call, or observability behavior changes.
   - SEO/public discovery: `docs/13-seo-and-content-discovery.md` if public indexability, metadata, sitemap, robots, canonical, structured data or search-discovery behavior changes.
6. Inspect existing code only enough to understand boundaries; do not plan production edits unless the owner explicitly asks to implement now.
7. Inspect `git status --short`.
8. Give a short plan: feature being changed, docs to update, task codes affected, checks, and whether implementation should be a later `/task-*` step.

## Rules

- Treat this as a feature behavior change, not a bug fix.
- This skill is docs/planning-only by default.
- A direct imperative that clearly asks to change the running feature now, such
  as “bỏ field này cho tôi”, “sửa logic này” or “đổi thành behavior này”, counts
  as an explicit implementation request unless the owner says they only want a
  plan/discussion. Do not report the feature as changed when only docs changed.
- If the owner only asks to inspect, discuss, or "lên kế hoạch" and does not
  explicitly ask to save/update docs or invoke `/update-feature`, return the plan
  in chat only. Do not edit repository docs, plans, context, roadmap, or code.
- Do not edit production code unless the owner explicitly says to implement in the same request.
- Do not change stack.
- Do not add behavior outside the owner's requested change.
- Update docs so they remain the source of truth before any later implementation.
- If the requested change conflicts with MVP scope or previous docs, state the conflict and apply the owner's latest decision only within the requested feature.
- If the change is large, split it into follow-up implementation tasks.
- If data removal, destructive migration, payment, auth, security, or production-impacting behavior is involved, stop and ask before destructive action.

## Documentation Updates

When scope is clear:

- Product/flow: update product scope and user flow docs.
- API: update API index/file if request/response/side effect changes.
- Database: update database index/file if schema/model meaning changes.
- UI: update UI docs if screens/components/UX expectations change.
- AI/RAG: update AI/RAG docs if prompts/schema/cache/retrieval behavior changes.
- Performance/observability: update performance docs if budgets, cache/index/query/job/AI latency, or observability standards change.
- SEO/public discovery: update SEO docs if index/noindex, metadata, sitemap, robots, canonical, structured data or public content discovery changes.
- Implementation plan: update `docs/implementation/Mx.md` if subtask scope/Done changes; update `docs/09-implementation-plan.md` only if order/dependencies change.
- Coverage/dependencies: update `docs/implementation/feature-coverage-matrix.md` or `docs/implementation/dependency-graph.md` when layer coverage, status, order, or dependency changes.
- Decision log: add/update `docs/decisions/` only for important long-term decisions.

## Task Code Rules

If the feature change affects roadmap/subtask codes:

- Prefer updating the existing task code that owns the feature, for example change scope/`Done khi` in `docs/implementation/M8.md` for `M8.3`.
- Create a new task code only when the change creates a clearly separate piece of work that should be implemented/reviewed independently.
- Do not renumber existing task codes unless the owner explicitly asks; renumbering breaks references.
- If dependencies or execution order change, update `docs/09-implementation-plan.md`.
- If feature coverage or dependency graph changes, update the matching helper docs.
- If `.codex/plans/codex-execution-plan.md` exists and the change affects near-term execution order/TODOs, update it too.
- Mention in the final response which task code was updated, added, or left unchanged.

## Verification

Run checks proportional to risk:

- Docs-only by default: `git diff --check`.
- If the owner explicitly requested implementation in the same request, run code checks proportional to changed code.

Do not update changelog in this workflow. Changelog is written only during `/commit` for the commit being created.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the feature update or plan is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when docs/code checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/update-feature <short feature>`. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Include:

- Feature changed and new behavior.
- Docs updated.
- Task code updated/added/left unchanged.
- No production code changed, unless explicitly requested.
- Planned technical flow after the change.
- Checks run or skipped with reason.
- Risks/TODO/ASSUMPTION.
- Suggested next implementation command with task code when possible, for example `/task-ui Mx.y`, `/task-connect Mx.y`, or `/task-full Mx.y`; include the task `Mode` and a one-sentence description of what that implementation task does.
