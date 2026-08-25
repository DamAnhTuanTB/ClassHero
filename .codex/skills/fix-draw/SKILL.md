---
name: fix-draw
description: Audit and implement changes to AI figure-drawing rules in the Vietnamese learning-path project from commands such as "/fix-draw sửa cách đặt nhãn góc". Use when the owner asks to fix, tune, standardize, or refactor drawing behavior, system prompts, structured schemas, validators, or generation contracts for Summary, Quiz, or another feature that creates figures. Discover every real figure consumer, compare applicability by feature, subject, mode, and layer, then update all and only the places where the requested intent is genuinely relevant. Do not use for UI-only styling, raster photo editing, or a one-off manual edit of one generated figure source.
---

# Figure Rule Consistency Runner

Use this skill to prevent a drawing-rule change from fixing one prompt while leaving genuinely related generation paths inconsistent. Optimize for complete semantic coverage, not mechanical symmetry or identical wording.

## Parse the Command

- `/fix-draw <request>`: audit, implement, document, and verify the requested rule change.
- `/fix-draw plan <request>`: build the applicability matrix and implementation plan only. Wait for explicit owner approval before editing code.
- `/fix-draw audit <request>`: inspect and report coverage gaps without changing repository files.
- Treat natural-language requests to fix, tune, standardize, or refactor AI drawing rules as equivalent when this skill clearly applies.
- Use a reported bad image as a regression fixture. Never define the general rule from names, numbers, coordinates, lesson IDs, or geometry unique to that image.

## Core Outcome: Đồng Bộ Có Điều Kiện

Before editing, build an applicability matrix across every discovered drawing path:

| Dimension | Required coverage                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature   | Summary/StemFigure, Quiz, and every other feature currently capable of generating or editing figures                                                                 |
| Subject   | MATH, PHYSICS, CHEMISTRY, GENERAL, and every additional supported subject discovered in code                                                                         |
| Mode      | Create, regenerate, edit, question figure, solution figure, refine, repair, and admin override variants that actually exist                                          |
| Layer     | System prompt, user prompt, structured schema, mapper/persistence, source policy/validator, worker/provider request, prompt/schema version, tests, and relevant docs |

Classify every matrix cell as:

- `APPLY`: the same invariant and wording are correct.
- `ADAPT`: the intent applies, but subject, feature, or mode semantics require different wording or enforcement.
- `NOT_APPLICABLE`: the path cannot express the object or the rule would be semantically wrong. Record the concrete reason.
- `BLOCKED`: the path is relevant but cannot be changed safely because an authority, contract, or dependency is missing. Report the blocker.

The task is complete only when every discovered, genuinely relevant cell is `APPLY` or `ADAPT`, or is explicitly reported as `BLOCKED`. Do not copy a rule into unrelated prompts merely to make files look synchronized. Do not omit a related path merely because its wording or schema differs.

## Required Startup

1. Read `AGENTS.md`.
2. Read `docs/09-implementation-plan.md`, the relevant section of `docs/implementation/M9.md`, `docs/06-ai-rag-spec.md`, and `docs/14-source-code-structure.md`.
3. Read API and database docs only when the requested change alters a persisted structure or public contract.
4. Read applicable decision records for prompt ownership, subject routing, figure modes, and model routing.
5. Read `.codex/plans/codex-execution-plan.md` when present and relevant.
6. Inspect `git status --short`; preserve all unrelated owner changes.
7. Discover current drawing consumers from resolvers and call sites. Never trust a remembered file list as complete.
8. State a short plan naming the requested invariant, matrix scope, known exclusions, files/layers likely involved, docs impact, and verification commands.

Search at minimum for:

- prompt directories and subject/mode resolvers;
- `build*Figure*Input`, prompt versions, and schema versions;
- Zod, JSON Schema, DTO, and shared types carrying figure instructions or source;
- generation, regeneration, edit, refine, repair, admin, worker, and provider call sites;
- regression tests that enumerate subjects, modes, or resolved prompts.

## Trace the Actual Pipeline

Map the real data flow before choosing where to enforce the rule:

```text
API or modal input
  -> Phase 1 semantic decision or figure plan
  -> subject and mode resolver
  -> Phase 2 drawing prompt and schema
  -> provider or worker
  -> source policy, validator, or compiler
  -> persistence
  -> review UI
```

- Do not add visual-layout prose to Phase 1 when Phase 1 only creates content or decides whether a figure is needed.
- Update Phase 1 when the requested behavior requires new authoritative semantic structure that Phase 2 cannot infer safely.
- Treat the following as examples, not a closed list:
  - Summary/StemFigure: source regeneration, source editing, new block generation, admin variants, and technical repair.
  - Quiz: question figures, solution extensions, solution redraw/model paths, and AI refinement across subjects.
  - Flashcard, Test, or future features: include only when current code proves that the feature can generate, edit, or validate figures.

## Choose the Correct Enforcement Layer

- Put semantic, spatial, and subject-specific visual rules in the owning system prompt.
- Change a schema only when a downstream consumer needs a new authoritative field or constraint. Then update all DTOs, shared types, mappers, persistence, API docs, fixtures, and consumers that genuinely carry it.
- Use deterministic validation or source policy for mechanical safety, syntax, compilation, and enforceable contracts. Do not pretend subjective visual quality can always be validated deterministically.
- Do not add self-reported fields such as `checksPassed` unless code actually consumes and verifies them.
- When Phase 1 and Phase 2 both mention a concept, define one authoritative owner and make the other phase consume or preserve it rather than independently inventing it.
- Bump the prompt version for every affected feature × subject × mode resolver. Bump schema versions and consumers only when the schema changes. Do not bump unaffected paths.

## Evaluate Every Subject Independently

For each subject, answer:

1. Can its figures contain the object governed by the requested rule?
2. Does the object have the same semantic meaning in this subject?
3. Which mode owns its position, identity, or visual convention?
4. Would the rule conflict with subject conventions or source-image authority?
5. What valid counterexample proves the rule is not over-broad?

Apply or adapt based on evidence:

- Point-label proximity may apply conditionally to geometry points, optical points, circuit nodes, experiment points, and general diagram nodes, with subject-appropriate wording.
- Angle-label proximity may apply to geometric angles, optical angles, bond angles, or general diagrams without importing unrelated Euclidean theorem rules.
- A ban on arrows parallel to edges must not automatically affect vectors, current direction, reaction arrows, force arrows, or flow arrows.
- Valence, charge, reaction, and apparatus conventions are chemistry-owned unless another subject genuinely uses the same semantics.
- Vector point of application, circuit polarity, and ray direction are physics-owned unless another subject genuinely uses the same semantics.

The subject shown in the reported screenshot is evidence, not the scope. The matrix determines the scope.

## Preserve Prompt Ownership and Composition

- Each subject resolver must return a complete subject-owned prompt for its feature and mode.
- Do not use a Math prompt as a global base for all subjects.
- Do not import prompt prose between subjects or between Summary and Quiz merely to reduce duplication.
- When one invariant is genuinely relevant in several owners, express or adapt it inside each owning subject prompt or its subject-local policy for the applicable modes.
- Dispatchers select subject and mode; they must not append generic drawing prose after subject resolution.
- Preserve the custom-system-prompt full-override contract unless the owner explicitly changes that behavior.

## Respect Authority and Mode

- A source image or accepted source figure is authoritative for intentional placement and conventions unless the edit request explicitly authorizes change.
- Create and regenerate modes may design a new layout within their contract.
- Edit modes may change only authorized elements and must preserve unrelated content.
- Technical repair should repair diagnostics and compilation defects, not redesign semantics or layout unless its contract explicitly permits it.
- Question-figure modes must not leak answers. Solution modes may reveal only what their documented contract allows.

## Reusable Spatial-Label Invariant

When the requested rule concerns label placement and the subject/mode cell is applicable, use these general constraints:

- Point or node names belong to the exact represented coordinate with a small readable gap. Try anchor changes, rotation, or side changes before increasing distance.
- Angle arcs originate at the exact vertex and use the correct rays. Put the angle value near the correct bisector, just outside the arc; move the arc radius and label together when resolving overlap.
- Length, distance, magnitude, or measurement labels belong to the exact segment, path, or arc they measure, or to an unambiguous interpolation between its endpoints. Prefer midpoint/`pos`, sliding, flipping, and a small perpendicular gap; use a leader line only when direct placement is genuinely impossible.
- The nearest visually compatible object must be the label's semantic owner unless an intentional subject convention or authoritative source explicitly says otherwise.
- Never encode absolute coordinates, hard-coded names, or sample-specific numbers as the general fix.
- Include counterexamples such as a crowded midpoint that requires a nearby offset or a legitimate leader line, so “near” does not become “must overlap.”

## Implement and Verify

1. Identify the root cause and finish the applicability matrix before editing.
2. Patch the smallest owning layers needed for every `APPLY` and `ADAPT` cell.
3. Preserve domain isolation and unrelated dirty-worktree changes.
4. Update prompt/schema versions according to actual impact.
5. Add or update an architecture regression test that enumerates every resolved relevant feature × subject × mode, including admin variants, instead of checking only the originally reported prompt.
6. Add positive and negative coverage:
   - the invariant appears or is structurally enforced where relevant;
   - subject-specific language does not leak elsewhere;
   - valid exceptions and counterexamples remain allowed;
   - unaffected versions and contracts remain unchanged.
7. Update `docs/06-ai-rag-spec.md` and relevant M9 implementation docs when AI behavior changes. Update API/database docs only for a real contract or persistence change. Add a reusable learning note when warranted. Do not update changelog outside `/commit`.
8. Run focused tests first, then formatter/static checks and API typecheck. Run broader checks when shared schemas, workers, or cross-feature prompt architecture changed.

Do not call a paid AI provider by default. Use local prompt/schema tests and fixtures. Before a live provider regression, state sample size and estimated cost, then wait for explicit owner approval.

If worker-loaded prompts or `apps/api/src/workers/*` changed, restart or clearly provide the command to restart `pnpm dev`. Explain that already generated figures keep their old source and must be regenerated or refined to reflect new prompt rules.

## Completion Gate

Do not report completion until all are true:

- The drawing-consumer inventory was derived from current resolvers and call sites.
- Every feature × subject × mode × layer cell was classified.
- Every genuinely relevant cell was updated or explicitly blocked.
- Every exclusion has a concrete semantic or architectural reason.
- Prompt and schema versions match the actual change surface.
- Regression coverage checks all relevant resolved prompts and at least one counterexample.
- AI, implementation, and contract docs remain consistent with code.
- Focused tests and required typechecks pass, or failures are reported with evidence.

When the repository notification script exists, call `.codex/scripts/notify-task.sh` with status `done`, `blocked`, or `failed` and a concise `/fix-draw ...` summary.

## Final Response

Lead with the outcome and root cause. Then state:

- coverage by feature, subject, mode, and layer;
- which paths were `APPLY`, `ADAPT`, or `NOT_APPLICABLE`, with reasons for exclusions;
- prompt/schema version and cache implications;
- tests and typechecks run, and whether any paid provider was called;
- important changed files;
- required restart, regeneration, custom-override caveat, or blocker.

Never claim “đã đồng bộ tất cả” merely because identical text was copied to multiple prompts. Claim it only after the applicability matrix and resolved-prompt regression prove that every truly related path was handled.
