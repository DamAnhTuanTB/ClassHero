---
name: review-docs
description: Review and optionally fix this repo's Codex-facing documentation, skills, prompts, README, and workflow consistency. Use when the user asks `/review-docs`, `review docs`, `rà soát tài liệu`, `review bộ docs/skills`, or wants to find contradictions, stale references, duplicated rules, or context bloat in Codex docs.
---

# Review Docs

Use this skill to audit Codex guidance files. Stay docs/skills/prompts focused unless the user explicitly asks to inspect production code.

## Workflow

1. Classify the review scope before reading:
   - Narrow review: one docs area, command, workflow, stale path, or reported
     contradiction. Read the relevant `AGENTS.md` section, `README.md`/docs map
     entry, the target files, and only indexes/contracts they directly reference.
   - Broad review: the owner explicitly asks to audit the full docs/skills set or
     the issue crosses many areas. Then inspect the main indexes, dependency and
     coverage docs, decisions index, context indexes, skills, and prompts.
2. Treat a runtime-injected current `AGENTS.md` as already read. Do not reopen it
   or any index in full unless exact lines are needed or the worktree version may
   differ.
3. Use headings/search to select sections in long docs. Read matching child files
   only when the review touches that domain; for example, inspect UI pattern files
   only for UI workflow review and performance/SEO/source-structure sections only
   when those rules are in scope.
4. Inspect `.codex/skills/*/SKILL.md` and `.codex/prompts/*.md` that mention or own
   the reviewed workflow. Scan the full set only for a broad consistency audit.
5. Check for:
   - stale command names such as old `/task` runner references;
   - wrong paths after docs were split;
   - overlapping or conflicting skill responsibilities;
   - missing docs-only/code-producing guardrails;
   - missing or stale source-code structure rules, especially route groups, feature folders, shared components, backend module layering, alias imports, and reusable error handling;
   - missing UI code-pattern enforcement in any skill that can create or touch forms, modals, detail grids, action controls, upload previews, badge/status UI, or state views;
   - stale UI code-pattern routing after pattern docs are split across `docs/ui-references/code-patterns/`;
   - stale current context, code index, feature coverage, dependency graph, or decision log references;
   - overly long repeated rules that should live in `AGENTS.md` or README instead.
   - context/index files that have become history logs instead of routing aids.
6. If the user asks to fix, or the issue is an obvious docs-only correction, patch the relevant docs.
7. Do not update changelog in this workflow. Changelog is written only during `/commit` for the commit being created.
8. Run lightweight checks such as `rg` for stale references, `pnpm format:check`, and `git diff --check` when relevant.

## Brevity Guard

- Index files should route to the source of truth, not repeat its detailed contract.
- A normal task should have a minimal context packet: exact subtask block, exact
  domain/contract sections, touched code/call sites/tests, and worktree status.
  Do not require full roadmap, milestone, UI, performance, source-structure, or
  context files when a section/entry answers the task.
- Keep `.codex/context/current-context.md` to the active direction, current
  subtask/status, latest relevant checks, blockers and links. Target roughly
  `<= 150` lines; move historical audits to ADRs, plans or artifacts.
- Keep `.codex/context/code-index.md` as path plus one concise ownership note;
  do not turn each row into a feature changelog.
- Keep implementation order in `docs/09-implementation-plan.md`, dependency
  detail in `docs/implementation/dependency-graph.md`, and layer coverage in
  `docs/implementation/feature-coverage-matrix.md`.
- Do not shorten by deleting unique product, API, database, security or AI
  invariants. Remove repetition only after confirming the canonical copy remains.

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
