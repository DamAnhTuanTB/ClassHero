-- Flashcard now owns its generated solution directly. Existing Flashcard
-- explanations are intentionally discarded instead of copied to the new field.
ALTER TABLE "flashcards"
DROP CONSTRAINT IF EXISTS "flashcards_explanation_id_fkey";

DELETE FROM "ai_explanations"
WHERE "target_type" = 'FLASHCARD';

DROP INDEX IF EXISTS "flashcards_explanation_id_idx";

ALTER TABLE "flashcards"
DROP COLUMN "explanation_id",
ADD COLUMN "solution_json" JSONB;
