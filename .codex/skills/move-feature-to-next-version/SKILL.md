---
name: move-feature-to-next-version
description: Move an existing feature out of the current MVP/version into a later version from commands like "/move-feature-to-next-version tạm hoãn livestream" or "chuyển tính năng abc sang version sau". Use when Codex must keep the feature documented for later instead of deleting it, update product scope/user flows/implementation task codes to mark it deferred, remove it from current execution order when needed, avoid destructive data/code deletion, update changelog, and explain what remains for the current version versus next version.
---

# Move Feature To Next Version Runner

Use this skill when the owner wants to postpone a feature, not delete it.

## Command Parsing

Accept:

- `/move-feature-to-next-version <feature description>`
- `/move feature to next version <feature description>`
- `chuyển tính năng <description> sang version sau`
- `tạm thời không làm <description>`
- `hoãn tính năng <description>`

If the feature or target version is unclear, assume "next version" and state that assumption.

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
   - SEO/public discovery: `docs/13-seo-and-content-discovery.md` if deferring a public/indexable feature, route, metadata, sitemap entry, robots rule, canonical or structured data.
6. Search existing code/docs for the feature.
7. Inspect `git status --short`.
8. Give a short plan: feature to defer, docs/tasks affected, current-version impact, checks.

## Core Rules

- Do not delete the feature as if using `/delete-feature`.
- Keep enough documentation so the feature can be resumed in a later version.
- Mark it as deferred/next-version/out of current MVP where appropriate.
- Do not drop database tables/fields or remove historical docs unless the owner explicitly asks.
- Do not renumber task codes.
- If current code already exposes the feature, disable or hide it only as needed for the current version and explain the replacement/current behavior.
- If the feature is only planned and not implemented, prefer docs/task updates only.

## Task Code Rules

If the feature has roadmap/subtask codes:

- Mark the relevant task in `docs/implementation/Mx.md` as deferred to next version.
- Remove or move it out of the current recommended order in `docs/09-implementation-plan.md` if it should not be executed now.
- Keep the original task code unless the owner asks to reorganize.
- Update dependencies for later tasks that depended on the deferred task.
- Update `docs/implementation/feature-coverage-matrix.md` and `docs/implementation/dependency-graph.md` when status/order/dependencies change.
- If `.codex/plans/codex-execution-plan.md` exists, update near-term next steps/TODOs so Codex does not suggest the deferred task next.
- Mention in the final response which task code was deferred and what current-version task replaces it, if any.

## Documentation Updates

When scope is clear:

- Product scope: move feature from current MVP to a "later version" or "deferred" note.
- User flows: remove the feature from current flows or mark it as future flow.
- UI docs: remove current-version screens/components or mark as future.
- API/database/AI/env docs: mark as future/deferred if already documented; do not delete details that are useful later unless requested.
- SEO/public discovery: remove from current-version SEO/indexing docs or mark future/deferred when the postponed feature affected public discovery.
- Implementation docs: mark task/subtask deferred and update order/dependencies.
- Decision log: add/update `docs/decisions/` only if deferral is an important long-term scope decision.

## Verification

Run checks proportional to changes:

- Docs-only: `git diff --check`.
- If UI/API code is hidden/disabled: run focused typecheck/build/curl/browser checks where practical.

Update changelog after file changes.

## Final Response

Include:

- Feature moved to next version.
- Current-version behavior after the change.
- Docs/tasks updated, including task code status.
- Code changed, if any.
- Checks run or skipped with reason.
- TODO/ASSUMPTION for next version.
