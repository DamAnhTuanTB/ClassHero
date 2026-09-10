---
name: fix-bug
description: Diagnose and fix a project-local bug from commands such as "/fix bug ...", "/fix ...", "sửa bug ...", or "fix lỗi ...". Gather evidence, identify root cause, apply the smallest safe fix, load only relevant contracts and conditional bug guidance, and verify proportionally.
---

# Bug Fix Runner

If the description is too vague to locate or reproduce safely, ask one concise question. Otherwise state any necessary assumption and continue.

## Minimal Startup

Before editing:

1. Apply the runtime-provided `AGENTS.md`; reopen only for exact changed lines.
2. Search the roadmap only to orient an unmapped bug. Read a subtask block only when its scope or contract affects the fix.
3. Open context, decisions, or execution-plan files only for a known relevant dependency or assumption.
4. Use the Task Routing Map to read only affected contract sections. For source-structure, performance, or SEO concerns, open the matching layer/route section rather than the full document.
5. For UI forms, modals, actions, uploads, badges, or state views, use `docs/ui-references/code-patterns.md` to open one matching pattern and compare the closest approved implementation.
6. For KaTeX, MathJax, LaTeX normalization, or display-math layout bugs, read [`references/math-content.md`](references/math-content.md). Do not read it for other bugs.
7. Inspect the symptom, current code, call sites, focused tests, and `git status --short`. Expand the reading set only if diagnosis reaches another surface.

For a small bug, give a 1–3 bullet plan covering evidence, likely files, and the focused check. Add contract/docs impact for larger bugs. Prompt files are not sources of truth.

## Diagnose and Fix

1. Gather the smallest realistic evidence: existing output, code path, focused command/test, or API request. Avoid starting browsers or servers unless requested or necessary to reproduce.
2. Establish the root cause before editing. Check relevant config/env, stale processes or generated artifacts, validation, permissions, API/schema/persistence contracts, providers, and workers.
3. Apply the smallest safe fix. Do not add features, change stack, broaden a refactor, or disturb unrelated worktree changes.
4. Preserve the general invariants in `AGENTS.md` and the affected domain contract, including source aliases, shared HTTP-error helpers, RBAC, real UI interactions, and worker restart requirements.
5. Update docs only when an actual contract, schema, AI behavior, env, workflow, performance, or SEO rule changes. Do not update changelog; `/commit` owns it.

Use a fuller diagnosis and verification path for auth/RBAC, payment, database/schema, API contracts, AI/RAG, workers, storage, notifications, security, or multi-module bugs. A small isolated bug may skip broad checks when the reason is reported.

If a fix needs a secret, paid-provider run, production access, destructive data action, or major product decision, follow the corresponding `AGENTS.md` gate and stop for owner input when required.

## Verify

1. Rerun the check that represents the original symptom, then add typecheck, tests, lint, build, API, or runtime verification in proportion to risk.
2. For a backend/API bug visible in the UI the owner is actively testing, verify the API origin actually used by the web app. Restart a stale owner-facing process when appropriate rather than relying on an alternate port.
3. Stop temporary servers started only for diagnosis. State whether any owner-facing server remains running.
4. If a deterministic check is available, do not claim success from inspection alone. If a required check cannot run, state why.

## Completion

Before the final response, call `.codex/scripts/notify-task.sh` from repo root with `done`, `blocked`, or `failed`, a concrete `/fix bug <topic>` label, and a short outcome. Notification failure does not block completion.

Report the confirmed cause, the narrow fix and technical flow, changed files, verification, and any restart, assumption, or unresolved item. Keep isolated fixes concise; for complex bugs, explain the before/after flow and reusable lesson in plain language. Update `docs/learning-notes/` only when the lesson is genuinely durable, after reading that folder's README and index.
