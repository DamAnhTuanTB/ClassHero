---
name: review-docs
description: Review and optionally fix this repo's Codex-facing documentation, skills, prompts, README, and workflow consistency. Use when the user asks `/review-docs`, `review docs`, `rà soát tài liệu`, `review bộ docs/skills`, or wants to find contradictions, stale references, duplicated rules, or context bloat in Codex docs.
---

# Review Docs

Use this skill to audit Codex guidance files. Stay docs/skills/prompts focused unless the user explicitly asks to inspect production code.

## Workflow

1. Read `AGENTS.md`, `README.md`, and the docs indexes:
   - `docs/00-docs-map.md` if present.
   - `docs/09-implementation-plan.md`
   - `docs/04-database-model.md`
   - `docs/05-api-contract.md`
   - `docs/12-performance-and-observability.md` if present.
   - `docs/13-seo-and-content-discovery.md` if present.
   - `docs/14-source-code-structure.md` if present.
   - `docs/ui-references/code-patterns.md` if present.
   - matching files in `docs/ui-references/code-patterns/` when the review touches UI code-pattern workflow.
   - `docs/ui-references/approved-patterns.md` if present.
   - `docs/implementation/dependency-graph.md` if present.
   - `docs/implementation/feature-coverage-matrix.md` if present.
   - `docs/decisions/README.md` if present.
   - `.codex/context/current-context.md` and `.codex/context/code-index.md` if present.
2. Inspect `.codex/skills/*/SKILL.md` and `.codex/prompts/*.md`.
3. Check for:
   - stale command names such as old `/task` runner references;
   - wrong paths after docs were split;
   - overlapping or conflicting skill responsibilities;
   - missing docs-only/code-producing guardrails;
   - missing or stale source-code structure rules, especially route groups, feature folders, shared components, backend module layering, alias imports, and reusable error handling;
   - missing UI code-pattern enforcement in any skill that can create or touch forms, modals, detail grids, action controls, upload previews, badge/status UI, or state views;
   - stale UI code-pattern routing after pattern docs are split across `docs/ui-references/code-patterns/`;
   - stale current context, code index, feature coverage, dependency graph, or decision log references;
   - overly long repeated rules that should live in `AGENTS.md` or README instead.
4. If the user asks to fix, or the issue is an obvious docs-only correction, patch the relevant docs.
5. Do not update changelog in this workflow. Changelog is written only during `/commit` for the commit being created.
6. Run lightweight checks such as `rg` for stale references, `pnpm format:check`, and `git diff --check` when relevant.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the review/fix is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when docs checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/review-docs` or the reviewed docs area. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Output

Report briefly:

- main issues found or `Không thấy mâu thuẫn lớn`;
- files changed, if any;
- checks run;
- suggested next command, if there is a clear next step.
