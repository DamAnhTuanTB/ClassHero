-- Solution figures are standalone artifacts generated from problem + solution.
-- Preserve every existing figure/revision/source while removing obsolete mode
-- and question-revision lineage metadata.
UPDATE "quiz_figures"
SET "plan_json" = jsonb_build_object(
  'version', 2,
  'role', 'SOLUTION',
  'problem', "plan_json"->>'problem',
  'solution', "plan_json"->>'solution'
)
WHERE "role" = 'SOLUTION'
  AND jsonb_typeof("plan_json") = 'object'
  AND NULLIF(BTRIM("plan_json"->>'problem'), '') IS NOT NULL
  AND NULLIF(BTRIM("plan_json"->>'solution'), '') IS NOT NULL;

ALTER TABLE "quiz_figure_revisions"
DROP CONSTRAINT IF EXISTS "quiz_figure_revisions_derived_from_question_revision_id_fkey";

DROP INDEX IF EXISTS "quiz_figure_revisions_derived_from_question_revision_id_idx";

ALTER TABLE "quiz_figure_revisions"
DROP COLUMN "derived_from_question_revision_id";

ALTER TABLE "quiz_questions"
DROP COLUMN "solution_figure_mode";

DROP TYPE "QuizSolutionFigureMode";
