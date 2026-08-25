BEGIN;

UPDATE "quiz_questions"
SET "solution_figure_mode" = 'NONE'
WHERE "solution_figure_mode" = 'REUSE_QUESTION';

ALTER TABLE "quiz_questions"
ALTER COLUMN "solution_figure_mode" DROP DEFAULT;

CREATE TYPE "QuizSolutionFigureMode_new" AS ENUM (
  'NONE',
  'EXTEND_QUESTION',
  'REDRAW_AS_MODEL'
);

ALTER TABLE "quiz_questions"
ALTER COLUMN "solution_figure_mode" TYPE "QuizSolutionFigureMode_new"
USING ("solution_figure_mode"::text::"QuizSolutionFigureMode_new");

DROP TYPE "QuizSolutionFigureMode";

ALTER TYPE "QuizSolutionFigureMode_new"
RENAME TO "QuizSolutionFigureMode";

ALTER TABLE "quiz_questions"
ALTER COLUMN "solution_figure_mode" SET DEFAULT 'NONE';

COMMIT;
