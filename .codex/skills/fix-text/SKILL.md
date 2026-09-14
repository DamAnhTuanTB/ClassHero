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
- In owner-facing reports, prefer explicit Vietnamese such as `số lượng tối thiểu`, `mức bao phủ bắt buộc`, or `phân bổ tối thiểu` instead of unexplained internal shorthand such as `quota`. When a prompt has both source-example coverage and a batch-level minimum, distinguish them precisely: rejecting one-output-per-source-example mapping must never be phrased as removing an independently required minimum for a content family such as real-world application problems.

## Explain Simple Ideas Simply

- When an idea can be stated clearly with familiar words, state it directly. Do not coin, translate, or introduce a technical label and then spend extra sentences explaining that label.
- Apply this rule both to AI prompts and to owner-facing explanations. Prefer the shortest wording that preserves the exact product rule; add structure only when it prevents a real ambiguity or bug.
- Reuse the owner's own clear wording when it is already precise. For this project's lesson-grounding rules, write `các kiến thức học sinh đã được học trước đó` instead of replacing it with a more academic label.
- Khi mô tả thứ tự trình bày lời giải, viết thẳng `viết công thức gốc, sau đó biến đổi công thức, rồi mới thay số`; không đổi thành các cụm khó hiểu như `hệ thức đã gắn đúng ký hiệu và đối tượng`, `khởi tạo quan hệ theo ngữ cảnh` hoặc cách nói tương tự.
- Không sửa một lỗi suy luận bằng cách thêm riêng tên của trường hợp vừa sai vào prompt, chẳng hạn chỉ dặn kiểm tra `hai góc đối đỉnh`. Phải sửa bằng quy tắc chung, dễ hiểu: `kiểm tra từng bước suy luận có thật sự suy ra từ dữ kiện, định nghĩa, công thức hoặc các bước đã chứng minh trước đó hay không; kiểm tra đủ điều kiện áp dụng trước khi kết luận`. Trường hợp vừa sai chỉ dùng làm bài test để chắc chắn lỗi không quay lại.
- If the current implementation is overengineered for a simple rule, remove unnecessary terminology, fields, enums, audit structures, or validation layers unless a downstream consumer demonstrably needs them.
- Do not append one new bullet and example for every reported bad output. First map the
  case to the smallest existing invariant and rewrite or consolidate that owning block.
  Keep one minimal representative example only when prose alone remains ambiguous and
  remove superseded wording so the stable prompt prefix does not grow by accumulation.

## Boundary With Figure Work and UI Copy

Use `/fix-text` when the requested change governs text that a learner or admin reads as learning content, including:

- knowledge prose, definitions, summaries, examples, questions, statements, options, hints, answers, solutions, explanations, feedback, conclusions, flashcard faces, test content, and chat answers;
- semantic correctness, self-containment, level of detail, pedagogical order, tone, grade suitability, mathematical or scientific notation in prose, and content-field formatting;
- structured-output fields, schema descriptions, validators, mappers, or renderers when they carry or enforce that textual contract.

Use `/fix-draw` instead when the change governs figure selection, a drawing plan, TikZ/SVG/source code, spatial labels on a canvas, visual topology, geometry, arrows, colors, or figure layout. Caption or alt text belongs to `/fix-text` when its wording or accessibility meaning is being changed; it belongs to `/fix-draw` when it is acting as part of the figure-generation contract. If one request genuinely spans both boundaries, apply both skills and keep separate applicability matrices.

Do not use this skill for static UI button labels, navigation copy, CSS typography, truncation, or layout unless the text is itself AI-generated learning content.

## Core Outcome: Đồng Bộ Có Điều Kiện

Before editing, build an applicability matrix across every discovered text-generation path:

| Dimension      | Required coverage                                                                                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature        | Summary/knowledge, Quiz, Flashcard, Test, AI explanation, Chat/Q&A, conversation summary, and every other current feature that generates or transforms learning text                                                                                                                                             |
| Content role   | Title, definition, concept/body, example, problem, statement, option, hint, answer, solution, explanation, feedback, conclusion, caption/alt text, and every additional role discovered in code                                                                                                                  |
| Subject        | MATH, PHYSICS, CHEMISTRY, GENERAL, and every additional supported subject discovered in code                                                                                                                                                                                                                     |
| Subject domain | Every materially different knowledge or problem family within the current subject. For MATH this must separate arithmetic/number and Algebra, functions/coordinate or analytic work, Geometry, statistics/probability/data, applied modeling, and every additional domain discovered in code or source contracts |
| Variant        | Every question/card/block type, difficulty, target grade, presentation preset, create/regenerate/edit/refine mode, and admin/custom-prompt variant that actually exists                                                                                                                                          |
| Layer          | System prompt, user prompt, structured schema description, Zod/JSON Schema/DTO, semantic validator or gate, mapper/persistence, worker/provider request, rendered cache prefix/breakpoints/cache key, renderer/normalizer, prompt/schema version, tests, and relevant docs                                       |

Classify every matrix cell as:

- `APPLY`: the same invariant and wording are correct.
- `ADAPT`: the intent applies, but the feature, content role, subject, question type, audience, or authority requires different wording or enforcement.
- `NOT_APPLICABLE`: the path cannot express the governed text or the rule would be semantically wrong. Record the concrete reason.
- `BLOCKED`: the path is relevant but cannot be changed safely because an authority, contract, or dependency is missing. Report the blocker.

The task is complete only when every discovered, genuinely relevant cell is `APPLY` or `ADAPT`, or is explicitly reported as `BLOCKED`. Do not copy a rule into unrelated fields merely to make files look synchronized. Do not omit a related path merely because it has another schema or vocabulary.

## Required Startup

1. Apply the runtime-provided `AGENTS.md`; do not reopen it mechanically.
2. Read the relevant M9 subtask block, `docs/06-ai-rag-spec.md` quick-routing
   section plus the affected feature sections, the AI prompt-cache performance
   section, and the relevant back-end/shared source-structure sections. Search
   `docs/09-implementation-plan.md` only when order/dependencies matter.
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
- subject-local knowledge and problem families; for MATH search at minimum for arithmetic/number, Algebra, equation/inequality, function/coordinate/analytic or calculus work, Geometry/proof/construction, statistics/probability/data, and applied modeling terms in both Vietnamese and English;
- mapper, persistence, renderer, sanitizer/normalizer, worker, provider, cache, and stale-data behavior;
- the final provider-serialized message/tool/schema order, explicit or implicit cache breakpoints, cache-key inputs, model-specific cache settings, and dynamic content placed before or inside a cacheable prefix;
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

## Evaluate Subject Domains Independently

Subject-level coverage is insufficient when one subject contains domains with materially different correctness, pedagogy, notation, or explanation contracts. Do not mark `MATH` covered after inspecting only Geometry or only Algebra prompts, fixtures, and outputs.

For MATH, inventory and classify at minimum:

- arithmetic, number work, Algebra, symbolic transformations, equations, inequalities, and systems;
- functions, coordinate or analytic work, sequences, limits, derivatives, integrals, or other supported advanced domains discovered in the source contract;
- Geometry, measurement, proof, and construction;
- statistics, probability, data interpretation, tables, and charts;
- applied mathematical modeling and every additional family current code or lesson sources can generate.

Adapt the same textual invariant to the domain instead of copying identical prose. For example, an Algebra solution must preserve equivalence, state domain or branch conditions when needed, and show essential transformations; a Geometry proof must establish required hypotheses and justified relationships; a statistics/probability explanation must identify the data, sample space, event, aggregation, or unit that supports its conclusion. These examples guide classification and are not mandatory boilerplate for unrelated tasks.

When a change can affect MATH across domains, regression coverage must include:

- an applicable Algebra/non-Geometry case for every rule that claims to govern general mathematical prose, reasoning, notation, or solutions;
- an applicable Geometry or another materially different MATH domain case when the rule claims cross-domain coverage;
- a valid counterexample where the wording or enforcement must be adapted or is not applicable, such as a concise final-answer field that must not expand into a derivation.

If a rule is genuinely domain-specific, classify the other domains as `NOT_APPLICABLE` with concrete reasons instead of weakening the rule or copying it everywhere. Apply the same domain-level split to Physics, Chemistry, or another subject whenever current code proves that its subdomains require materially different text contracts.

## Preserve Prompt Ownership and Composition

- Each feature and subject resolver must return a complete prompt owned by that domain when the architecture requires subject isolation.
- Do not import Summary prompt prose into Quiz, or use Math as a global base for Physics, Chemistry, or General.
- When one invariant is genuinely shared, express or adapt it inside each owning prompt or subject-local policy; shared infrastructure may hold types and resolver mechanics, not cross-domain prompt prose where the project forbids it.
- Dispatchers select feature, subject, role, and variant; they must not append hidden generic prose after a complete subject prompt has been resolved.
- Preserve the custom-system-prompt and custom-user-prompt full-override contract unless the owner explicitly changes it. Report that default-prompt fixes do not alter existing custom overrides.

## Respect Content Authority

- Treat the selected lesson packet or documented source context as the knowledge authority. Do not invent facts, examples, conditions, numerical data, citations, or conclusions absent from the allowed source and task contract.
- Prefer direct, ordinary wording whenever the same rule can be stated clearly without a coined label or specialist shorthand.
- For source-grounded assessment, keep the contract simple: the generated set covers the assessable problem families in the lesson as fully as the requested count allows, and every question directly relates to lesson content. `Các kiến thức học sinh đã được học trước đó ở cùng khối hoặc khối dưới` may support the question or solution.
- Preserve accepted or manually edited content outside the authorized change scope.
- Keep question, answer, and solution mutually consistent. The solution derives the answer; it must not alter the problem to make an answer fit.
- Do not expose hidden chain-of-thought. Request only the concise, student-facing derivation, evidence, or explanation necessary for the product output.
- Question-facing fields must not leak the answer through wording, hints, option patterns, conclusions, figures, or metadata.
- Answers should carry only their contracted result. Explanatory prose belongs to solution/explanation fields unless the schema explicitly combines them.
- Renderer-added prefixes such as `Đáp án:` or option labels must appear exactly once; provider output must not duplicate them when code owns presentation.

## Preserve Prompt Cacheability

Treat prompt caching as an implementation invariant alongside semantic correctness. Correct ownership and output quality take priority; never move a system-owned rule into a run-specific user prompt merely to retain a cache hit.

Before editing a prompt, schema, tool definition, or provider setting:

1. Inspect the effective serialized OpenAI request, not only the source string. Record the ordered system/developer content, tools, structured-output schema bytes, relevant model/settings, explicit or implicit breakpoints, and the first dynamic lesson/request token.
2. Classify the proposed change as:
   - `NO_INVALIDATION`: it is strictly after the reusable breakpoint and does not alter any earlier rendered token or cache-sensitive setting;
   - `PRESERVED_BREAKPOINT`: an existing reusable prefix and its breakpoint remain byte/token stable while a later stable or dynamic block changes;
   - `NEW_STABLE_PREFIX_WARMUP`: the owning system prompt, schema, tools, settings, or another token before the breakpoint must change, so the old full cache entry cannot be assumed reusable and the new prefix needs a warm-up;
   - `CACHE_ARCHITECTURE_CHANGE`: breakpoint placement, prefix partitioning, cache-key derivation, retention, or provider serialization changes and therefore needs explicit architecture review and broader tests.
3. Prefer the smallest additive change in the owning stable prompt. Append a new stable rule near the end of the appropriate subject/feature-owned rule block when semantics allow; do not reorder, renumber, reformat, or rewrite earlier stable content merely to insert it. Appending text alone does not prove that an old cache entry remains reusable: verify the actual rendered breakpoint.
4. Keep reusable policy, tool definitions, and deterministic schema before the breakpoint. Keep PDF/source packets, lesson IDs, manifests, admin/custom user input, counts, difficulty, and other run-specific data after it. Do not interpolate dynamic values into the stable prefix or `prompt_cache_key`.
5. Change schema structure or field order only for a real contract need. Preserve deterministic serialization and stable tool/schema ordering; schema descriptions are part of the rendered cached context.
6. Bump only affected prompt/schema versions. A changed stable prefix may intentionally produce a new cache key; the key must continue to represent the effective static prefix and must not be used to mask an exact-prefix mismatch.

Verification must compare effective serialized requests for at least two different dynamic inputs of the same contract:

- bytes/tokens through the intended breakpoint remain identical;
- dynamic content begins after that breakpoint;
- the same static contract resolves to the same cache key, while a changed static prompt/schema/version resolves to a different key when keying is enabled;
- unrelated prompt/schema ordering and cache settings are unchanged.

Local tests can prove composition and key stability, not a provider cache hit. Use stored `cachedInputTokens`, `cacheWriteInputTokens`, cache-hit ratio, or the OpenAI Prompt Caching dashboard for post-deploy evidence; call a paid provider only when the owner explicitly requests a live test. That request is sufficient approval. Choose the necessary affected stable-prefix/cache-contract cases that collectively cover the main cache behaviors and risks in the applicability matrix; when cache behavior itself is under acceptance, run the request sequence required to prove the selected case. Equivalent cells may share one case when the reason is documented. Do not choose only the cheapest prefix or use a cache-only observation for a case whose acceptance requires a live provider.

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
5. Add or update architecture regression tests that enumerate every resolved relevant feature × subject × subject domain × content role × variant, including admin/custom paths when applicable.
6. Add positive and negative coverage:
   - the invariant appears or is structurally enforced where relevant;
   - feature- or subject-specific prose does not leak elsewhere;
   - answer/solution/question roles remain consistent and non-duplicative;
   - valid exceptions and counterexamples remain allowed;
   - unaffected versions, schemas, caches, and contracts remain unchanged.
7. Update `docs/06-ai-rag-spec.md` and relevant M9 implementation docs when AI text behavior changes. Update API/database docs only for a real contract or persistence change. Add a reusable learning note when warranted. Do not update changelog outside `/commit`.
8. Run focused prompt/schema/mapper tests first, then formatter/static checks and API/web typechecks as relevant. Run broader checks when shared schemas, workers, renderers, or cross-feature prompt architecture changed.

Do not call a paid AI provider by default. Use local prompt/schema tests and fixtures. When the owner requests a live provider regression, treat that request as cost approval, derive the main scenarios and important risks from the `APPLY` and `ADAPT` cells, then choose the necessary representative feature × subject × subject domain × content role × variant cases whose combined coverage is sufficient. Do not run every Cartesian combination when equivalent cases can be grouped, but document the coverage reason. Estimate the budget for that coverage set and optimize cost only after coverage is sufficient; never drop a main scenario merely to make the run cheaper. Run without waiting for a second confirmation. If a budget guard prevents required coverage, report the remaining cases as `Not run` and do not claim the live regression passed. Report actual usage and estimated cost afterward when available.

If worker-loaded prompts or `apps/api/src/workers/*` changed, restart or clearly provide the command to restart `pnpm dev`. Explain that already generated or cached content retains its old output until it is regenerated, refreshed, or marked stale according to the existing contract.

## Completion Gate

Do not report completion until all are true:

- The text-consumer inventory was derived from current resolvers and call sites.
- Every relevant feature × role × subject × subject domain × variant × layer cell was classified.
- MATH coverage includes applicable Algebra/non-Geometry and Geometry or other materially different domains; a single-domain audit cannot satisfy a cross-domain claim.
- Every genuinely relevant cell was updated or explicitly blocked.
- Every exclusion has a concrete semantic or architectural reason.
- Prompt and schema versions match the actual change surface.
- Cache impact is classified; serialized-request regression proves the stable/dynamic boundary, or an unavoidable `NEW_STABLE_PREFIX_WARMUP`/`CACHE_ARCHITECTURE_CHANGE` is documented with the expected new key/version behavior.
- Regression coverage checks all relevant resolved prompts/contracts and at least one counterexample.
- AI, implementation, API/database, and renderer docs remain consistent with code where applicable.
- Focused tests and required typechecks pass, or failures are reported with evidence.

When the repository notification script exists, call `.codex/scripts/notify-task.sh` with status `done`, `blocked`, or `failed` and a concise `/fix-text ...` summary.

## Final Response

Lead with the outcome and root cause. Then state:

- coverage by feature, content role, subject, subject domain, variant/mode, and layer;
- which paths were `APPLY`, `ADAPT`, or `NOT_APPLICABLE`, with reasons for exclusions;
- prompt/schema version, cache-impact classification, whether the old prefix remains reusable, and expected steady-state cache behavior after warm-up;
- tests and typechecks run, and whether any paid provider was called;
- important changed files;
- required restart, regeneration, custom-override caveat, or blocker.

Never claim “đã đồng bộ tất cả” merely because identical wording was copied to several prompts. Claim it only after the applicability matrix and resolved-prompt regression prove that every truly related text-generation path was handled.
