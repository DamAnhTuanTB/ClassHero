# Task Full Implementation Mode

Read this file only for `/task-full ...` execution.

## Implement the complete slice

Build every layer required by the named subtask and its `Mode`, using the current
repo structure and existing shared patterns:

- API/backend: boundary validation/RBAC, controller, service, persistence/provider
  flow, response mapping, and API docs when the contract changes.
- Database: schema, safe migration, seed/test data, and database docs when required.
- Front-end: route/screen, hooks/API client/form/state, responsive interactive
  states, and shared components when reuse is real.
- Worker/integration: queue, idempotency, provider/status/error flow, and restart
  guidance required by `AGENTS.md`.
- Shared package and docs only when a cross-app contract or source of truth changes.

Use the source placement, alias, shared error, UI pattern, performance, SEO,
security, paid-provider, and worker rules already routed from `AGENTS.md`; do not
duplicate or weaken them locally.

## Verification by risk

- Tiny isolated/docs-only: smallest useful format, diff, focused validator, or
  targeted typecheck; explain any skipped larger check.
- Normal implementation: affected-package typecheck plus focused tests; add
  lint/build/curl/runtime checks when the changed surface needs them.
- Large or high-risk work—multiple modules/packages, auth/RBAC, payment,
  schema/migration, API contract, worker/queue, storage, AI/provider, security, or
  an end-to-end production flow—requires focused tests and the relevant package or
  integration/E2E gates. State `Not run: <reason>` for any unavailable layer.
- If a test harness is missing, add only a reusable focused setup that is within
  scope; do not expand into unrelated test infrastructure.

When `multi-agent-execution` is active, use targeted checks per stable batch and
run full affected typecheck/lint/build/integration/E2E gates after lanes converge.
Rerun only checks invalidated by later changes.

## Documentation and handoff

- Update context, code index, dependency graph, or coverage matrix only when task
  status, paths, dependencies, or layer coverage changed.
- Update learning notes only for a durable reusable lesson; if doing so, read the
  learning-notes routing index and merge into the closest existing note.

Final response should scale with risk. Always report the completed task, material
changes, files, checks/skips, and blockers/assumptions. For code/behavior changes,
add a concise end-to-end technical flow and why it fits the repo. Mention context
or learning-note updates only when they occurred. Suggest a next roadmap task only
when clear, with command, exact `Mode`, and one-sentence purpose.
