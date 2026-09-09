-- M6.6: keep the existing quiz_figures table and allow it to target exactly one
-- assessment question. Existing Quiz rows remain valid without data movement.
ALTER TABLE "quiz_figures"
  ALTER COLUMN "quiz_question_id" DROP NOT NULL,
  ADD COLUMN "test_question_id" UUID;

ALTER TABLE "quiz_figures"
  ADD CONSTRAINT "quiz_figures_test_question_id_fkey"
  FOREIGN KEY ("test_question_id") REFERENCES "test_questions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quiz_figures"
  ADD CONSTRAINT "quiz_figures_exactly_one_question_target_check"
  CHECK (
    ("quiz_question_id" IS NOT NULL AND "test_question_id" IS NULL)
    OR
    ("quiz_question_id" IS NULL AND "test_question_id" IS NOT NULL)
  );

CREATE UNIQUE INDEX "quiz_figures_test_question_id_role_key"
  ON "quiz_figures"("test_question_id", "role");

CREATE INDEX "quiz_figures_test_question_id_deleted_at_idx"
  ON "quiz_figures"("test_question_id", "deleted_at");

ALTER TABLE "provider_usage_events"
  DROP CONSTRAINT IF EXISTS "provider_usage_events_operation_check";

ALTER TABLE "provider_usage_events"
  ADD CONSTRAINT "provider_usage_events_operation_check"
  CHECK (
    "operation" IS NULL OR "operation" IN (
      'SUMMARY_GENERATION', 'QUIZ_GENERATION', 'FLASHCARD_GENERATION', 'TEST_GENERATION',
      'EXPLANATION_GENERATION', 'CHAT_RESPONSE_GENERATION', 'EMBEDDING_GENERATION',
      'DOCUMENT_EXTRACTION', 'DIAGRAM_GENERATION', 'QUIZ_SOLUTION_REFINEMENT',
      'QUIZ_SOLUTION_REGENERATION', 'SUMMARY_FIGURE_GENERATION',
      'SUMMARY_QUESTION_FIGURE_GENERATION', 'SUMMARY_SOLUTION_FIGURE_GENERATION',
      'SUMMARY_FIGURE_EDITING', 'SUMMARY_FIGURE_REPAIR',
      'QUIZ_QUESTION_FIGURE_GENERATION', 'QUIZ_QUESTION_FIGURE_EDITING',
      'QUIZ_QUESTION_FIGURE_REFINEMENT', 'QUIZ_SOLUTION_FIGURE_GENERATION',
      'QUIZ_SOLUTION_FIGURE_EDITING', 'QUIZ_SOLUTION_FIGURE_REFINEMENT',
      'FLASHCARD_SOLUTION_FIGURE_GENERATION',
      'TEST_QUESTION_FIGURE_GENERATION', 'TEST_QUESTION_FIGURE_EDITING',
      'TEST_QUESTION_FIGURE_REFINEMENT', 'TEST_SOLUTION_FIGURE_GENERATION',
      'TEST_SOLUTION_FIGURE_EDITING', 'TEST_SOLUTION_FIGURE_REFINEMENT'
    )
  );
