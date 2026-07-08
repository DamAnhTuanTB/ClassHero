---
name: fix-bug
description: Fix bugs in the Vietnamese learning-path project from commands like "/fix bug mô tả lỗi", "/fix bug lỗi 500 khi mở API", or "sửa bug mô tả". Use when Codex must read relevant project docs, map the bug to the likely milestone/module, reproduce or gather enough evidence, identify root cause, make the smallest safe fix, scale process and checks to bug size, avoid unrelated changes, update changelog, verify with focused commands when practical, then explain the bug cause and concise handling approach with applied technical flow.
---

# Bug Fix Runner

Use this skill for project-local bug fixing. Keep the workflow evidence-first: understand the bug, reproduce or inspect logs, find root cause, then patch narrowly.

## Command Parsing

Accept these forms:

- `/fix bug <bug description>`
- `/fix <bug description>`
- `sửa bug <bug description>`
- `fix lỗi <bug description>`

If the description is too vague to locate or reproduce safely, ask one concise question. Otherwise make a reasonable assumption and continue.

## Required Startup

Before editing files:

1. Locate repo root containing `AGENTS.md`.
2. Read `AGENTS.md`.
3. Read `docs/09-implementation-plan.md` enough to map the bug to the likely milestone/subtask; read the matching milestone file in `docs/implementation/` if subtask detail is needed.
4. If present, read `.codex/plans/codex-execution-plan.md` for known dependencies, assumptions, or recent plan notes.
5. Use the `Task routing map` in `AGENTS.md` to choose the project docs relevant to the suspected bug area.
6. If the bug is about slowness, lag, timeout, cache, query, worker delay, AI latency, or observability, read `docs/12-performance-and-observability.md`.
7. If the bug is about public pages not being indexable, wrong metadata, slug, sitemap, robots, canonical, Open Graph, structured data, or Google discovery, read `docs/13-seo-and-content-discovery.md`.
8. Read those docs before code changes. If the suspected area changes during diagnosis, read the newly relevant docs too.
9. Inspect `git status --short` and preserve unrelated user changes.
10. Give a short plan: suspected module/subtask, docs read, reproduction/evidence command, likely files, docs to update if behavior changes, and verification commands.

Do not use prompt files as source of truth. Use project docs and code.

## Lean Mode For Small Bugs

For small, low-risk bugs, finish quickly by using the lightest safe workflow.

Allowed reductions:

- Read only `AGENTS.md`, enough of `docs/09-implementation-plan.md` to orient the bug, directly relevant routing docs, logs/error output, and touched code.
- Use existing error output or a simple code inspection as evidence when spinning up servers, browsers, or full flows would be overkill.
- Keep the plan to 1-3 short bullets.
- Run one focused verification command, a quick curl, a validator, or no command if the change is docs/wording-only.
- Skip broad `build`, full test suites, or full regression checks when the bug is isolated and low risk.

Non-negotiable:

- Do not guess root cause when evidence is insufficient; say what is assumed.
- Do not skip safety checks for secrets, scope, stack, MVP, or unrelated dirty files.
- Do not skip changelog when repository files changed in a commit-worthy way.
- If a check is skipped, state `Not run: <short reason>` in changelog and final response.
- Use the fuller workflow for auth/RBAC, payment, database/schema, API contract, AI/RAG, worker, storage, notification, security, or multi-module bugs.

## Diagnosis Workflow

1. Reproduce the bug with the smallest realistic command, curl, page visit, test, or dev-server run.
2. Capture the useful symptom: status code, stack trace, console output, failing test, request path, or UI state.
3. If reproduction is not possible, explain why and use the best available evidence from code, logs, docs, and user description.
4. Identify the root cause before editing. Avoid speculative fixes.
5. Check whether the bug is caused by config/env, runtime process not restarted, API contract mismatch, schema mismatch, permission/RBAC, validation, or stale generated files.

## Fix Rules

- Make the smallest fix that addresses the root cause.
- Do not change the approved stack.
- Do not add features outside MVP.
- Do not refactor broad areas just because they are nearby.
- Do not overwrite or revert unrelated dirty files.
- Update docs only when the actual contract, schema, AI/RAG behavior, env, or workflow changes.
- If a database/API/AI behavior change is required, follow `AGENTS.md` rules for updating the corresponding docs.
- If SEO/indexability behavior changes, update `docs/13-seo-and-content-discovery.md` or related public docs when needed.
- If the bug reveals a small roadmap dependency/TODO issue, update `.codex/plans/codex-execution-plan.md`; ask the owner before major roadmap or scope changes.
- If a fix requires a secret, paid service, production access, or large product decision, stop and ask.

## Verification

After the fix:

1. Rerun the command or flow that exposed the bug.
2. Run verification proportional to risk: focused checks for small bugs; broader `typecheck`, `build`, `lint`, or tests for shared, production, or multi-module changes.
3. If a long-running server was started, stop it unless the user asked to keep it running.
4. Update `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md` using the concise format from `AGENTS.md`.
5. If tests cannot run, write the reason in changelog and final response.

## Completion Notification

Before the final response, call `.codex/scripts/notify-task.sh` from the repo root:

- `done` when the bug fix is complete.
- `blocked` when owner input is needed before continuing.
- `failed` when reproduction, implementation, or checks fail and the task cannot be finished in this turn.

Use a concrete task label such as `/fix bug <short topic>`. Keep the message short, outcome-focused, and free of secrets. Notification failure must not block the final response.

## Final Response

Keep the final answer useful, but do not over-compress the technical explanation. The owner is non-coding but wants to learn the technical flow. Include:

- Nguyên nhân bug: what broke, why it broke, and where it happened.
- Cách xử lý: explain what changed, why it fixes the root cause, and the applied technical flow through the touched code.
- `Giải thích kỹ thuật dễ hiểu`:
  - Mục tiêu kỹ thuật của fix.
  - Luồng code trước khi lỗi xảy ra và luồng code sau khi sửa.
  - Kỹ thuật đã dùng để xử lý: validation, config, controller/service, Prisma, hook/state, worker/provider, etc.; explain the role instead of only naming tools.
  - Vì sao cách sửa này đúng root cause and does not expand scope.
  - File quan trọng: where the symptom appeared, where the root cause lived, and where the fix was applied.
  - Bạn nên hiểu gì sau bug này: 2-4 lessons learned.
- Verification: commands run and result.
- Files changed.
- Notes: restart required, env/config needed, TODO/ASSUMPTION, or execution plan update.
- Next action: the next check or likely `/task-ui`, `/task-connect`, or `/task-full` command if the bug blocks roadmap work. When recommending a roadmap command, include the task `Mode` and a one-sentence description of what that task does.

Do not merge cause and fix into a vague summary. If the root cause is uncertain, say what was confirmed, what remains an assumption, and how the fix was verified.

In `Cách xử lý` and `Giải thích kỹ thuật dễ hiểu`, describe the flow path, not just tool names. Examples:

- Front-end: page/component -> hook/API client -> state/cache -> UI update.
- Back-end: controller -> DTO/guard/validation -> service -> Prisma/external provider -> response.
- Worker/AI: API -> BullMQ job -> worker/provider -> DB/status/cache.
- Docs/config-only: say there is no runtime code flow.

## Learning Notes

After a bug fix, update `docs/learning-notes/` only when the bug teaches a reusable lesson.

- Read `docs/learning-notes/README.md` and `docs/learning-notes/index.md` first.
- Prefer updating the affected feature note in `docs/learning-notes/features/`.
- Use `docs/learning-notes/foundation/` for reusable config/tooling/database/worker lessons.
- Add the lesson under `Luồng lỗi thường gặp`, `Kiến thức cần nhớ`, or the most relevant section.
- Do not store one-off symptoms, stack traces, secrets, private URLs, or noisy logs.
- Do not copy the final response verbatim.
- Update changelog if learning notes changed.
- If not updated, mention briefly in the final response.

## Changelog

Keep bug-fix changelog entries short:

- `Summary`: one sentence about the fixed symptom/root cause.
- `Changed`: 1-2 key points only.
- `Files`: grouped paths when useful.
- `Tests`: reproduction or focused verification command, or `Not run`.

Do not duplicate the full final explanation in changelog.
