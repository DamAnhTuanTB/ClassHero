---
name: learning-task-runner
description: Run roadmap subtasks for the Vietnamese learning-path project from commands like "/task M0.1", "/task M1.1 + M1.2 + M1.3", "làm M8.3", or "theo subtask tiếp theo". Use when Codex must parse one or more implementation-plan subtask IDs, determine required docs from AGENTS.md Task routing map, read docs before coding, keep scope to requested subtasks, scale process and checks to task size, maintain .codex/plans/codex-execution-plan.md when it is wrong or incomplete, update changelog, report files/tests, explain the implemented code/data flow in plain language, and suggest the next subtask ID.
---

# Learning Task Runner

Use this skill to execute project subtasks by ID while enforcing the repo's documentation-first workflow.

## Command Parsing

Accept these forms:

- `/task M0.1`
- `/task M1.1, M1.2, M1.3`
- `làm M8.3`
- `làm M1.1, M1.2, M1.3`
- `tiếp tục subtask tiếp theo`

Parse all subtask IDs in order. If no ID is given, use `.codex/plans/codex-execution-plan.md` and `docs/09-implementation-plan.md` to identify the next safe subtask; if still ambiguous, ask one concise question.

Multiple subtasks are allowed only when the user explicitly lists them. Execute them sequentially, not as one blended task. Stop before the next subtask if the current one fails validation or creates unresolved scope/risk.

## Required Startup

Before coding any subtask:

1. Locate the repo root containing `AGENTS.md`.
2. Read `AGENTS.md`.
3. Read the requested subtask section in `docs/09-implementation-plan.md`.
4. If present, read `.codex/plans/codex-execution-plan.md` for order/dependencies.
5. Use the `Task routing map` in `AGENTS.md` to choose docs to read for the subtask's milestone.
6. Read those docs before editing files.
7. Inspect existing code/files for the module being changed.
8. For UI tasks, apply the project mobile-first rule from `AGENTS.md` and `docs/08-ui-pages-and-components.md`.
9. Give a short plan: subtask, docs read, files/modules likely touched, docs likely updated, commands to run.

Do not substitute `.codex/prompts/*` for project docs. Prompt files are examples for the owner, not source of truth.

## Lean Mode For Small Tasks

For small, low-risk subtasks or tiny follow-up edits, finish quickly by scaling the workflow down.

Allowed reductions:

- Read only `AGENTS.md`, the relevant `docs/09-implementation-plan.md` section, directly relevant routing docs, and touched code.
- Keep the plan to 1-3 short bullets.
- Run the smallest useful verification command, such as a focused typecheck, validator, curl, or no command if the change is docs/wording-only.
- Skip broad `build`, full test suites, or cross-module checks when the touched files and risk do not justify them.
- Keep the final response compact.

Non-negotiable:

- Do not skip scope, stack, MVP, secret, or unrelated-change checks.
- Do not skip changelog when repository files changed in a commit-worthy way.
- If a check is skipped, state `Not run: <short reason>` in changelog and final response.
- Use the full workflow for schema, API behavior, auth/RBAC, payment, AI/RAG, worker, storage, notification, migration, or multi-module changes.

## Scope Rules

- Keep changes inside the requested subtask.
- Do not change the approved stack.
- Do not add features outside MVP.
- Do not skip docs because the user prompt is short.
- For UI work, prioritize mobile-first layouts while keeping laptop/desktop usable.
- If a dependency subtask is missing, say so and either stop or implement only the requested scaffold if safe.
- If a requested subtask needs files from another subtask to compile/run, state the reason before editing and record it in changelog.
- If docs conflict, apply priority from `AGENTS.md` and report the conflict.

For `/task Mx.y + Mx.z`, complete and verify each subtask as its own unit. Update changelog entries clearly enough that each completed subtask can be reviewed independently.

## Execution Checklist

For each subtask:

1. Implement only the subtask's `Phạm vi`.
2. Respect its `Không làm` and `Done khi` sections.
3. Update docs when behavior changes:
   - Database/schema: `docs/04-database-model.md`
   - API contract: `docs/05-api-contract.md`
   - AI/RAG behavior: `docs/06-ai-rag-spec.md`
   - Env/integration: `docs/07-integration-and-env.md`
   - UI pages/components: `docs/08-ui-pages-and-components.md`
4. Run verification proportional to risk: focused checks for small tasks; broader format/lint/typecheck/test/build for shared, production, or multi-module changes.
5. Maintain `.codex/plans/codex-execution-plan.md` using the "Execution Plan Maintenance" rules below.
6. Update `.codex/changelog/CHANGELOG_YYYY-MM-DD_codex.md` using the concise format from `AGENTS.md`.
7. Prepare the technical flow summary using the "Technical Flow Summary" rules below.
8. Determine the next suggested subtask using the "Next Subtask Suggestion" rules below.
9. Final response must include completed subtask IDs, files changed, commands run or skipped with reason, test status, technical flow summary, remaining TODO/ASSUMPTION, whether the execution plan was updated, and suggested next subtask ID.

## Execution Plan Maintenance

While working on a subtask, treat `.codex/plans/codex-execution-plan.md` as the project roadmap that may need maintenance.

Update it in the same task when you discover clear, local corrections such as:

- a missing or wrong dependency between subtasks,
- a TODO/ASSUMPTION discovered from docs or implementation,
- a completed owner-approved decision that affects task order or prerequisites,
- an outdated note that conflicts with `AGENTS.md`, `docs/09-implementation-plan.md`, or the current repo state,
- a subtask that should mention an implementation prerequisite already discovered during this task.

Do not silently make large roadmap changes. Ask the owner before editing the execution plan when the change would:

- reorder milestones or major feature groups,
- split/merge/add/remove subtasks,
- change MVP scope or business rules,
- change the approved stack or architecture,
- contradict a source document without an owner decision.

If the execution plan is updated, include it in changelog and final files changed. If it was checked but did not need changes, say so briefly in the final response.

## Technical Flow Summary

After completing requested work, explain briefly and clearly how the code flow works and which techniques/patterns were applied. Write for an owner who wants to understand the implementation without reading the diff.

Rules:

- Keep it short but concrete: 3-8 bullets, or a compact paragraph for docs-only tasks.
- Mention only areas touched by the task.
- Explain the path of data/control flow, not only technology names.
- Use plain language first, technical names second.
- Name important boundaries/patterns when present: component -> hook -> API client, controller -> DTO/guard -> service -> Prisma, API -> queue -> worker -> DB, provider abstraction, cache/idempotency, transaction.
- Do not invent layers that were not changed.
- If no code was changed, say it was docs/config/skill-only.

Suggested shape:

```txt
Luồng kỹ thuật đã làm:
- Front-end: <component/page> gọi <hook/API client>; TanStack Query/Zustand/form validation xử lý <state/mutation/validation>; UI cập nhật theo <response/cache>.
- Back-end: request đi qua <controller> -> <DTO/validation/guard> -> <service>; service áp dụng <business rule/pattern> rồi trả response theo contract.
- Database: service dùng <Prisma transaction/query/migration/index/constraint> để lưu/đọc <entity> và đảm bảo <integrity/idempotency/permission>.
- Worker/AI/Integration: API enqueue <BullMQ job> hoặc gọi <provider abstraction>; worker/provider xử lý <step> rồi cập nhật <DB/status/cache/log>.
- Docs/config-only: thay đổi này chỉ cập nhật <docs/config/skill>, không có runtime code flow.
```

## Next Subtask Suggestion

After completing requested work, always suggest the next subtask the owner should run.

How to choose:

1. Prefer `.codex/plans/codex-execution-plan.md` if present because it contains the project-specific order and dependencies.
2. Otherwise use `docs/09-implementation-plan.md` order.
3. If the user completed multiple subtasks, suggest the next subtask after the last successfully completed ID.
4. If a dependency is missing or validation failed, suggest the blocking prerequisite instead of blindly suggesting the next numeric ID.
5. If there are unresolved TODO/ASSUMPTION items that should be decided before moving on, say that the next action is to resolve them and name the likely subtask after that.
6. Keep the suggestion short: one primary next subtask, plus at most one alternative if there is a real branch.

Final response format should include a line like:

```txt
Gợi ý tiếp theo: /task M0.2 — Tooling, env example, Docker local và health check.
```

## Changelog

Use the concise changelog format from `AGENTS.md`. Prefer one short entry with:

- `Summary`: one sentence.
- `Changed`: 1-2 key points only.
- `Files`: grouped paths when useful.
- `Tests`: commands run or `Not run`.

If multiple subtasks are completed in one request, either add one compact entry per subtask or one compact combined entry with clear subtask IDs.

If tests cannot run, write `Not run: <reason>` in changelog and final response.
