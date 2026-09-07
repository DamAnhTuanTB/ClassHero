ALTER TABLE "provider_usage_events"
  ADD COLUMN "operation" TEXT,
  ADD COLUMN "reasoning_effort" TEXT;

ALTER TABLE "provider_usage_events"
  ADD CONSTRAINT "provider_usage_events_operation_check"
  CHECK (
    "operation" IS NULL OR "operation" IN (
      'SUMMARY_GENERATION',
      'QUIZ_GENERATION',
      'FLASHCARD_GENERATION',
      'TEST_GENERATION',
      'EXPLANATION_GENERATION',
      'CHAT_RESPONSE_GENERATION',
      'EMBEDDING_GENERATION',
      'DOCUMENT_EXTRACTION',
      'DIAGRAM_GENERATION',
      'QUIZ_SOLUTION_REFINEMENT',
      'QUIZ_SOLUTION_REGENERATION',
      'SUMMARY_FIGURE_GENERATION',
      'SUMMARY_QUESTION_FIGURE_GENERATION',
      'SUMMARY_SOLUTION_FIGURE_GENERATION',
      'SUMMARY_FIGURE_EDITING',
      'SUMMARY_FIGURE_REPAIR',
      'QUIZ_QUESTION_FIGURE_GENERATION',
      'QUIZ_QUESTION_FIGURE_EDITING',
      'QUIZ_QUESTION_FIGURE_REFINEMENT',
      'QUIZ_SOLUTION_FIGURE_GENERATION',
      'QUIZ_SOLUTION_FIGURE_EDITING',
      'QUIZ_SOLUTION_FIGURE_REFINEMENT'
    )
  ),
  ADD CONSTRAINT "provider_usage_events_reasoning_effort_check"
  CHECK (
    "reasoning_effort" IS NULL OR "reasoning_effort" IN (
      'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'
    )
  );
