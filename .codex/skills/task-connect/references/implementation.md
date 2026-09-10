# Task Connect Implementation Mode

Read only for `/task-connect ...` execution.

## Connect the complete slice

- Replace typed mock data with a feature API client and TanStack Query hooks.
  Use mutation pending/error state and invalidate/refetch affected queries;
  optimistic updates only when rollback is safe and not auth/payment/security
  sensitive.
- Preserve semantic interactions, responsive behavior, both themes and routed UI
  patterns. Remove or isolate mocks so production data cannot be confused with
  fixtures.
- Keep API calls out of deep render components. Follow `@/...`/`#api/...` aliases,
  frontend feature boundaries and backend controller → DTO/guard/validation →
  service → Prisma/provider layering.
- Reuse existing clients/hooks/services/shared contracts. Backend enforces RBAC,
  ownership and shared HTTP error envelopes; UI guards are only UX.
- Implement missing endpoint/schema/migration only when required by the subtask,
  including contract docs. Select only needed data, avoid N+1, debounce search and
  paginate long lists when applicable.
- When an approved UI field lacks storage, either extend the in-scope contract or
  explicitly keep it non-persistent with owner-visible rationale; never silently
  delete it.

## Verification and handoff

- Small mapping/wiring changes: affected typecheck or focused client/API test,
  curl/validator or `git diff --check` as appropriate.
- New endpoint, write flow, auth/RBAC, schema, storage, worker, shared client or
  multi-screen connection: run affected web/API/shared typechecks, focused
  integration tests and relevant lint/build/runtime/E2E gates.
- Verify pending/error/cache invalidation and the actual API origin used by the
  owner-facing web app. Restart stale API/worker processes when required.
- Save screenshots only in screenshot mode. Report every unavailable required
  layer as `Not run: <reason>`.

Update learning notes only for a durable end-to-end lesson. Final reports mock
data replaced, endpoint/hooks/backend added, technical flow, files, checks and
assumptions; suggest the next task only when clear.
