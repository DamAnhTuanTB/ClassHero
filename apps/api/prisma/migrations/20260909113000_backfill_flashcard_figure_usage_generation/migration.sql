UPDATE "flashcard_figures" AS figure
SET
  "ai_generation_id" = generation."id",
  "updated_at" = CURRENT_TIMESTAMP
FROM "flashcards" AS flashcard
JOIN "ai_generations" AS generation
  ON generation."id"::text = flashcard."source_metadata_json"->>'aiGenerationId'
WHERE figure."flashcard_id" = flashcard."id"
  AND figure."ai_generation_id" IS NULL
  AND generation."type" = 'FLASHCARD'
  AND generation."target_type" = 'FLASHCARD_SET'
  AND generation."target_id" = flashcard."flashcard_set_id";

UPDATE "provider_usage_events" AS usage_event
SET "ai_generation_id" = figure."ai_generation_id"
FROM "background_jobs" AS background_job
JOIN "flashcard_figures" AS figure
  ON figure."id" = background_job."resource_id"
WHERE usage_event."background_job_id" = background_job."id"
  AND usage_event."ai_generation_id" IS NULL
  AND usage_event."operation" = 'FLASHCARD_SOLUTION_FIGURE_GENERATION'
  AND background_job."resource_type" = 'FLASHCARD_FIGURE'
  AND figure."ai_generation_id" IS NOT NULL;
