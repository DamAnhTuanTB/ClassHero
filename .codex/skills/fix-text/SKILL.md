---
name: fix-text
description: Audit and implement changes to AI-generated learning text in the Vietnamese learning-path project from commands such as "/fix-text sửa văn phong lời giải". Use when the owner asks to fix, tune, standardize, or refactor non-figure content such as knowledge prose, questions, statements, options, hints, answers, solutions, explanations, feedback, or text formatting across Summary, Quiz, Flashcard, Test, Chat, or another text-generating feature. Discover every real text consumer, compare applicability by feature, content role, subject, question type, mode, and layer, then update all and only the places where the requested intent is genuinely relevant. Do not use for figure composition, labels drawn on a canvas, UI-only copy, or a one-off manual content edit.
---

# Learning Text Rule Consistency Runner

Use this skill to prevent a text-generation rule from fixing one prompt or field while leaving genuinely related paths inconsistent. Optimize for complete semantic coverage, not identical prose in every prompt.

## Parse the Command

- `/fix-text <request>`: audit, implement, document, and verify the requested text rule change.
- `/fix-text plan <request>`: build the applicability matrix and implementation plan only. Wait for explicit owner approval before editing code.
- `/fix-text audit <request>`: inspect and report coverage gaps without changing repository files.
- Treat natural-language requests to fix, tune, standardize, or refactor AI-generated learning text as equivalent when this skill clearly applies.
- Use a reported bad output only as a regression fixture. Never hard-code its lesson, wording, names, numbers, answer, or subject-specific accident into a general rule.

## Boundary With Figure Work and UI Copy

Use `/fix-text` when the requested change governs text that a learner or admin reads as learning content, including:

- knowledge prose, definitions, summaries, examples, questions, statements, options, hints, answers, solutions, explanations, feedback, conclusions, flashcard faces, test content, and chat answers;
- semantic correctness, self-containment, level of detail, pedagogical order, tone, grade suitability, mathematical or scientific notation in prose, and content-field formatting;
- structured-output fields, schema descriptions, validators, mappers, or renderers when they carry or enforce that textual contract.

Use `/fix-draw` instead when the change governs figure selection, a drawing plan, TikZ/SVG/source code, spatial labels on a canvas, visual topology, geometry, arrows, colors, or figure layout. Caption or alt text belongs to `/fix-text` when its wording or accessibility meaning is being changed; it belongs to `/fix-draw` when it is acting as part of the figure-generation contract. If one request genuinely spans both boundaries, apply both skills and keep separate applicability matrices.

Do not use this skill for static UI button labels, navigation copy, CSS typography, truncation, or layout unless the text is itself AI-generated learning content.

## Core Outcome: Đồng Bộ Có Điều Kiện

Before editing, build an applicability matrix across every discovered text-generation path:

| Dimension | Required coverage |
| --------- | ----------------- |
| Feature | Summary/knowledge, Quiz, Flashcard, Test, AI explanation, Chat/Q&A, conversation summary, and every other current feature that generates or transforms learning text |
| Content role | Title, definition, concept/body, example, problem, statement, option, hint, answer, solution, explanation, feedback, conclusion, caption/alt text, and every additional role discovered in code |
| Subject | MATH, PHYSICS, CHEMISTRY, GENERAL, and every additional supported subject discovered in code |
| Variant | Every question/card/block type, difficulty, target grade, presentation preset, create/regenerate/edit/refine mode, and admin/custom-prompt variant that actually exists |
| Layer | System prompt, user prompt, structured schema description, Zod/JSON Schema/DTO, semantic validator or gate, mapper/persistence, worker/provider request, renderer/normalizer, prompt/schema version, tests, and relevant docs |

Classify every matrix cell as:

- `APPLY`: the same invariant and wording are correct.
- `ADAPT`: the intent applies, but the feature, content role, subject, question type, audience, or authority requires different wording or enforcement.
- `NOT_APPLICABLE`: the path cannot express the governed text or the rule would be semantically wrong. Record the concrete reason.
- `BLOCKED`: the path is relevant but cannot be changed safely because an authority, contract, or dependency is missing. Report the blocker.

The task is complete only when every discovered, genuinely relevant cell is `APPLY` or `ADAPT`, or is explicitly reported as `BLOCKED`. Do not copy a rule into unrelated fields merely to make files look synchronized. Do not omit a related path merely because it has another schema or vocabulary.

## Required Startup

1. Read `AGENTS.md`.
2. Read `docs/09-implementation-plan.md`, the relevant section of `docs/implementation/M9.md`, `docs/06-ai-rag-spec.md`, and `docs/14-source-code-structure.md`.
3. Read product flow, API, and database docs when the requested change alters user-visible behavior, a public contract, or persisted structure.
4. Read applicable decision records for prompt ownership, subject routing, model/phase routing, structured output, cache, and custom overrides.
5. Read `.codex/plans/codex-execution-plan.md` when present and relevant.
6. Inspect `git status --short`; preserve all unrelated owner changes.
7. Discover current text consumers from resolvers and call sites. Never trust a remembered feature or field list as complete.
8. State a short plan naming the requested invariant, matrix scope, known exclusions, likely owning files/layers, docs impact, and verification commands.

Search at minimum for:

- prompt directories, subject resolvers, prompt builders, prompt versions, and schema versions;
- `build*Prompt`, `build*Input`, `generate*`, `regenerate*`, `explain*`, `refine*`, and chat/Q&A call sites;
- Zod, JSON Schema, DTO, and shared types for all relevant content fields;
- question types, block types, card types, difficulties, target grades, presentation presets, and admin/custom prompt paths;
- mapper, persistence, renderer, sanitizer/normalizer, worker, provider, cache, and stale-data behavior;
- regression tests that enumerate subjects, variants, resolved prompts, schema descriptions, and output mapping.

## Trace the Actual Pipeline

Map the real data flow before choosing where to enforce the rule:

```text
API or modal configuration
  -> source packet or retrieval context
  -> subject, feature, content-role, and variant resolver
  -> system prompt + user prompt + structured schema
  -> provider or worker
  -> validation and semantic gates
  -> mapper and persistence
  -> renderer and review/learner UI
  -> cache, stale, regeneration, or explanation reuse
```

- Keep Phase 1 textual content rules in the Phase 1 owner. Do not add them to Phase 2 drawing prompts merely because figures are generated later.
- Update a figure plan only when the requested text invariant changes authoritative semantic information needed by drawing; then use `/fix-draw` for the visual half.
- Distinguish generation content from explanation content. An explanation may use an existing answer as authority but must not silently rewrite the stored question or answer.
- Distinguish provider output from deterministic renderer text. Do not ask the model to emit labels or prefixes already added exactly once by code.

## Choose the Correct Enforcement Layer

- Put semantic correctness, writing style, pedagogy, audience, subject convention, and field responsibility in the owning system prompt.
- Keep run-specific source, count, difficulty, target grade, presentation choices, and admin instructions in the user prompt or request contract when that is their current owner.
- Change a schema only when structure, required presence, type, cardinality, or a downstream authoritative field must change. Then update every DTO, shared type, mapper, persistence layer, API doc, fixture, and consumer that genuinely carries it.
- Use schema field descriptions for concise field-local invariants; avoid duplicating the entire system policy into every leaf field.
- Use deterministic validation for mechanically enforceable properties such as missing fields, invalid enum/cardinality, exact option-answer consistency, forbidden wrappers, line separation, or parseable notation. Do not pretend nuanced pedagogy or prose quality is fully deterministic.
- Do not add self-reported fields such as `isCorrect`, `styleChecked`, or `requirementsSatisfied` unless trusted code independently verifies and consumes them.
- When prompt, schema, validator, and renderer touch the same concept, designate one semantic authority and make the other layers preserve or enforce it rather than inventing competing versions.
- Bump prompt versions for every affected feature × subject × variant resolver. Bump schema versions and consumers only when the schema actually changes. Do not bump unaffected paths.

## Evaluate Every Feature, Role, Subject, and Variant Independently

For each matrix cell, answer:

1. Can this path produce the governed kind of text?
2. Does the text serve the same role for the learner or admin?
3. Which layer owns its truth, wording, structure, and presentation?
4. Does the subject or question type require a different convention?
5. Would the rule leak an answer, duplicate content, contradict source authority, or over-constrain a valid response?
6. What valid counterexample proves the rule is not over-broad?

Apply or adapt based on evidence:

- A step-by-step solution convention may apply to worked examples, Quiz solutions, Test solutions, and AI explanations, but not to a short-answer field that must contain only the final value.
- A “state the conclusion” rule may require one concluding sentence in a solution while an answer field remains concise and non-duplicative.
- Mathematical notation rules may need adaptations for chemical equations, physical units, prose-heavy subjects, and plain-language accessibility text.
- A multiple-choice explanation may compare distractors; a true/false statement explanation must justify the truth value; a multi-statement item needs statement-aligned coverage; a flashcard back should not be expanded into an essay by default.
- Grade suitability may affect vocabulary and sentence complexity without changing factual depth or inventing a rigid writing stereotype for each grade band.
- Source-grounding and anti-copy rules must preserve necessary technical terms, formulas, quotations permitted by the contract, and canonical definitions.

The feature or subject shown in a bad sample is evidence, not the scope. The applicability matrix determines the scope.

## Preserve Prompt Ownership and Composition

- Each feature and subject resolver must return a complete prompt owned by that domain when the architecture requires subject isolation.
- Do not import Summary prompt prose into Quiz, or use Math as a global base for Physics, Chemistry, or General.
- When one invariant is genuinely shared, express or adapt it inside each owning prompt or subject-local policy; shared infrastructure may hold types and resolver mechanics, not cross-domain prompt prose where the project forbids it.
- Dispatchers select feature, subject, role, and variant; they must not append hidden generic prose after a complete subject prompt has been resolved.
- Preserve the custom-system-prompt and custom-user-prompt full-override contract unless the owner explicitly changes it. Report that default-prompt fixes do not alter existing custom overrides.

## Respect Content Authority

- Treat the selected lesson packet or documented source context as the knowledge authority. Do not invent facts, examples, conditions, numerical data, citations, or conclusions absent from the allowed source and task contract.
- Preserve accepted or manually edited content outside the authorized change scope.
- Keep question, answer, and solution mutually consistent. The solution derives the answer; it must not alter the problem to make an answer fit.
- Do not expose hidden chain-of-thought. Request only the concise, student-facing derivation, evidence, or explanation necessary for the product output.
- Question-facing fields must not leak the answer through wording, hints, option patterns, conclusions, figures, or metadata.
- Answers should carry only their contracted result. Explanatory prose belongs to solution/explanation fields unless the schema explicitly combines them.
- Renderer-added prefixes such as `Đáp án:` or option labels must appear exactly once; provider output must not duplicate them when code owns presentation.

## Reusable Learning-Text Invariants

When applicable, use these as decision criteria rather than mandatory boilerplate:

- **Correct and source-grounded:** every claim, symbol, unit, condition, and conclusion agrees with the authorized source and with other fields in the same item.
- **Self-contained by role:** a problem contains enough information to solve; a solution identifies the relevant reasoning and reaches the contracted answer; an explanation is understandable without relying on hidden provider reasoning.
- **Pedagogical order:** present known facts or principle, the necessary derivation or evidence, then the conclusion. Omit redundant restatement and irrelevant meta commentary.
- **Role separation:** do not copy the whole problem into the solution, the whole solution into the answer, or renderer-owned labels into provider text.
- **Audience fit:** use vocabulary, sentence length, and explanation depth suitable for `targetGrade` and the selected presentation preset while preserving subject precision.
- **Subject notation:** keep formulas, units, chemical notation, symbols, and Markdown/TeX delimiters valid for the renderer and appropriate to the subject.
- **Readable structure:** subparts and statement-aligned reasoning remain visibly separated; prose and display mathematics use their intended boundaries; avoid walls of text when a short sequence is clearer.
- **No answer leakage or fabricated certainty:** question-facing text stays neutral, and uncertainty in source evidence is not rewritten as a definitive fact.

Always include a counterexample in the design or tests. For example, “concise” must not delete a necessary justification; “step-by-step” must not force verbose arithmetic into a flashcard; “simple language” must not replace a required technical term with an inaccurate synonym.

## Implement and Verify

1. Identify the root cause and finish the applicability matrix before editing.
2. Patch the smallest owning layers needed for every `APPLY` and `ADAPT` cell.
3. Preserve feature/subject isolation and unrelated dirty-worktree changes.
4. Update prompt/schema versions according to the real impact surface.
5. Add or update architecture regression tests that enumerate every resolved relevant feature × subject × content role × variant, including admin/custom paths when applicable.
6. Add positive and negative coverage:
   - the invariant appears or is structurally enforced where relevant;
   - feature- or subject-specific prose does not leak elsewhere;
   - answer/solution/question roles remain consistent and non-duplicative;
   - valid exceptions and counterexamples remain allowed;
   - unaffected versions, schemas, caches, and contracts remain unchanged.
7. Update `docs/06-ai-rag-spec.md` and relevant M9 implementation docs when AI text behavior changes. Update API/database docs only for a real contract or persistence change. Add a reusable learning note when warranted. Do not update changelog outside `/commit`.
8. Run focused prompt/schema/mapper tests first, then formatter/static checks and API/web typechecks as relevant. Run broader checks when shared schemas, workers, renderers, or cross-feature prompt architecture changed.

Do not call a paid AI provider by default. Use local prompt/schema tests and fixtures. Before a live provider regression, state sample size and estimated cost, then wait for explicit owner approval.

If worker-loaded prompts or `apps/api/src/workers/*` changed, restart or clearly provide the command to restart `pnpm dev`. Explain that already generated or cached content retains its old output until it is regenerated, refreshed, or marked stale according to the existing contract.

## Completion Gate

Do not report completion until all are true:

- The text-consumer inventory was derived from current resolvers and call sites.
- Every relevant feature × role × subject × variant × layer cell was classified.
- Every genuinely relevant cell was updated or explicitly blocked.
- Every exclusion has a concrete semantic or architectural reason.
- Prompt and schema versions match the actual change surface.
- Regression coverage checks all relevant resolved prompts/contracts and at least one counterexample.
- AI, implementation, API/database, and renderer docs remain consistent with code where applicable.
- Focused tests and required typechecks pass, or failures are reported with evidence.

When the repository notification script exists, call `.codex/scripts/notify-task.sh` with status `done`, `blocked`, or `failed` and a concise `/fix-text ...` summary.

## Final Response

Lead with the outcome and root cause. Then state:

- coverage by feature, content role, subject, variant/mode, and layer;
- which paths were `APPLY`, `ADAPT`, or `NOT_APPLICABLE`, with reasons for exclusions;
- prompt/schema version and cache implications;
- tests and typechecks run, and whether any paid provider was called;
- important changed files;
- required restart, regeneration, custom-override caveat, or blocker.

Never claim “đã đồng bộ tất cả” merely because identical wording was copied to several prompts. Claim it only after the applicability matrix and resolved-prompt regression prove that every truly related text-generation path was handled.
