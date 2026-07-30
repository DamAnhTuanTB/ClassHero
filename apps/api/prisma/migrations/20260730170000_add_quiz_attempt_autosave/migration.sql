ALTER TABLE "quiz_attempts"
ADD COLUMN "current_question_index" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "quiz_attempt_answers"
ADD COLUMN "is_answered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_checked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "quiz_attempt_answers"
SET
  "is_answered" = true,
  "is_checked" = true
WHERE "answer_json" <> '{"__pending": true}'::jsonb;
