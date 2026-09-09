ALTER TABLE "provider_usage_events"
ADD COLUMN "target_context_json" JSONB;

UPDATE "provider_usage_events"
SET "target_context_json" = jsonb_build_object(
  'version', 1,
  'kind', CASE "operation"
    WHEN 'SUMMARY_GENERATION' THEN 'LESSON_SUMMARY'
    WHEN 'QUIZ_GENERATION' THEN 'QUIZ_SET'
    WHEN 'FLASHCARD_GENERATION' THEN 'FLASHCARD_SET'
    WHEN 'TEST_GENERATION' THEN 'TEST_SET'
  END,
  'entityId', "ai_generation_id"
)
WHERE "target_context_json" IS NULL
  AND "operation" IN (
    'SUMMARY_GENERATION',
    'QUIZ_GENERATION',
    'FLASHCARD_GENERATION',
    'TEST_GENERATION'
  );

UPDATE "provider_usage_events" AS usage
SET "target_context_json" = jsonb_build_object(
  'version', 1,
  'kind', 'QUIZ_QUESTION',
  'entityId', question."id",
  'itemOrdinal', GREATEST(1, question."sort_order" + 1),
  'figureRole', CASE figure."role"::text
    WHEN 'QUESTION' THEN 'QUESTION'
    ELSE 'SOLUTION'
  END
)
FROM "background_jobs" AS job
JOIN "quiz_figures" AS figure ON figure."id" = job."resource_id"
JOIN "quiz_questions" AS question ON question."id" = figure."quiz_question_id"
WHERE usage."background_job_id" = job."id"
  AND usage."target_context_json" IS NULL
  AND job."resource_type" = 'QUIZ_FIGURE';

UPDATE "provider_usage_events" AS usage
SET "target_context_json" = jsonb_build_object(
  'version', 1,
  'kind', 'FLASHCARD_CARD',
  'entityId', card."id",
  'itemOrdinal', GREATEST(1, card."sort_order" + 1),
  'figureRole', 'SOLUTION'
)
FROM "background_jobs" AS job
JOIN "flashcard_figures" AS figure ON figure."id" = job."resource_id"
JOIN "flashcards" AS card ON card."id" = figure."flashcard_id"
WHERE usage."background_job_id" = job."id"
  AND usage."target_context_json" IS NULL
  AND job."resource_type" = 'FLASHCARD_FIGURE';

UPDATE "provider_usage_events" AS usage
SET "target_context_json" = jsonb_build_object(
  'version', 1,
  'kind', 'QUIZ_QUESTION',
  'entityId', question."id",
  'itemOrdinal', GREATEST(1, question."sort_order" + 1),
  'figureRole', NULL
)
FROM "background_jobs" AS job
JOIN "quiz_questions" AS question ON question."id" = job."resource_id"
WHERE usage."background_job_id" = job."id"
  AND usage."target_context_json" IS NULL
  AND job."resource_type" = 'QUIZ_SOLUTION_REFINEMENT';

UPDATE "provider_usage_events" AS usage
SET "target_context_json" = jsonb_build_object(
  'version', 1,
  'kind', 'SUMMARY_BLOCK',
  'entityId', figure."id",
  'sectionOrdinal', NULLIF((regexp_match(figure."block_path", '^sections\.([0-9]+)\.blocks\.([0-9]+)$'))[1], '')::integer + 1,
  'blockOrdinal', NULLIF((regexp_match(figure."block_path", '^sections\.([0-9]+)\.blocks\.([0-9]+)$'))[2], '')::integer + 1,
  'blockKind', CASE lower(COALESCE(figure."plan_json"->'blockContent'->>'type', ''))
    WHEN 'theory' THEN 'THEORY'
    WHEN 'concept' THEN 'THEORY'
    WHEN 'note' THEN 'NOTE'
    WHEN 'warning' THEN 'NOTE'
    WHEN 'example' THEN 'EXAMPLE'
    WHEN 'exercise' THEN 'EXERCISE'
    WHEN 'problem' THEN 'EXERCISE'
    ELSE 'OTHER'
  END,
  'figureRole', CASE figure."plan_json"->>'targetMode'
    WHEN 'QUESTION' THEN 'QUESTION'
    WHEN 'SOLUTION' THEN 'SOLUTION'
    ELSE 'ILLUSTRATION'
  END
)
FROM "background_jobs" AS job
JOIN "stem_figures" AS figure ON figure."id" = job."resource_id"
WHERE usage."background_job_id" = job."id"
  AND usage."target_context_json" IS NULL
  AND job."resource_type" = 'STEM_FIGURE'
  AND figure."block_path" ~ '^sections\.[0-9]+\.blocks\.[0-9]+$';
