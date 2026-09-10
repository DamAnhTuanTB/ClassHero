# Task Connect Plan Mode

Read only for `/task-connect plan ...`.

- Planning is read-only: do not implement endpoints, replace mock data, install,
  migrate, stage, commit or update changelog.
- Inspect only enough UI/client/backend/contract code to identify ownership,
  missing API/schema work, dependencies, risks and credible verification.
- Output an approval-gated plan with task/Mode, preserved UI, mock boundary,
  endpoints/services/hooks to reuse or add, database/docs impact, end-to-end flow,
  ordered steps, checks and assumptions.
- Record inspected paths and Git condition for later `/do` delta revalidation,
  then stop for explicit owner approval.
