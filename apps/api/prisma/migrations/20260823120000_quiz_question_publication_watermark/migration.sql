ALTER TABLE "quiz_questions"
ADD COLUMN "published_at" TIMESTAMP(3);

UPDATE "quiz_questions" AS question
SET "published_at" = question."updated_at"
FROM "quiz_sets" AS quiz_set
WHERE question."quiz_set_id" = quiz_set."id"
  AND question."deleted_at" IS NULL
  AND question."review_status" = 'APPROVED'
  AND quiz_set."deleted_at" IS NULL
  AND quiz_set."review_status" = 'APPROVED';

CREATE INDEX "quiz_questions_quiz_set_id_published_at_idx"
ON "quiz_questions"("quiz_set_id", "published_at");
