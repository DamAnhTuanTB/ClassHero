---
name: update-feature
description: Update an existing feature in the Vietnamese learning-path project from `/update-feature ...`, `đổi tính năng ...`, or `sửa logic tính năng ...`. Update the affected source-of-truth docs and roadmap task codes by default; implement production behavior only when the owner explicitly asks to do it now.
---

# Update Feature

Use for an intentional behavior change to an existing feature, not for a defect
whose intended contract is unchanged. Ask one concise question only when the
feature or desired behavior cannot be identified safely.

## Authority And Mode

- Invoking `/update-feature` authorizes docs and planning changes, not production
  code by itself.
- Inspection, discussion, or a plan request without permission to save changes is
  read-only: answer in chat and do not edit the repo.
- Implement now only when the same request explicitly asks for implementation or
  gives an unmistakable direct imperative to change the running feature. Otherwise
  finish the docs update and recommend the appropriate `/task-*` command.
- Never claim the feature is implemented when only its contract or plan changed.

## Minimal Context

1. Apply the runtime `AGENTS.md`; do not reopen it mechanically.
2. Search for the owning feature and task code. Read the affected product/flow
   sections and the complete matching `docs/implementation/Mx.md` subtask block.
3. Use the Task Routing Map in `AGENTS.md` to load only affected contract sections.
   Read dependency, coverage, context, or execution-plan entries only when the
   requested change can alter them.
4. Inspect current code and direct call sites enough to confirm the real boundary,
   then inspect `git status --short`.
5. State a short plan covering behavior, affected sources/tasks, implementation
   mode, cross-layer impact, and checks.

Expand context only when evidence shows another contract or consumer is affected.

## Update Rules

- Keep the approved stack and unrelated behavior unchanged. The owner's latest
  scoped decision wins; report any conflict with existing MVP or contracts.
- Update only sources whose facts change: product/flow, API, database, UI, AI/RAG,
  env/integration, performance, SEO, source structure, and implementation docs.
- Trace contract changes across every real consumer. For example, removing a field
  normally requires checking UI, payload/types, API/service, DB/worker, tests, and
  docs unless the owner explicitly requests a UI-only hide.
- Prefer updating the existing task code that owns the feature. Add a code only for
  independently implementable work; do not renumber existing codes without an
  explicit request.
- Update order, dependency graph, coverage matrix, context, or execution plan only
  when that information actually changes. Record an ADR only for a durable decision.
- Split large implementation work into scoped follow-up tasks. Do not perform a
  destructive migration or production action without the authority required by
  `AGENTS.md`.

If implementation is explicitly requested, preserve this contract and follow the
relevant task workflow for code edits and proportional verification.

## Verify And Finish

- Docs-only: run formatting or docs validation when available and
  `git diff --check` on the affected files.
- With implementation: also run checks proportional to every changed layer.
- Do not update the changelog or commit; those belong to `/commit`.
- Before final, call `.codex/scripts/notify-task.sh` with `done`, `blocked`, or
  `failed`; notification failure does not fail the task.

Report the new behavior, sources changed, task-code decision, implementation
status, technical flow, checks, and any risk or assumption. When code remains,
suggest the next `/task-ui`, `/task-connect`, or `/task-full` command with its task
code, Mode, and one-sentence scope.
