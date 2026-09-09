-- Test Admin reuses the Quiz publication lifecycle. A reviewed question is staged
-- until SAVE/PUBLISH stamps it, while existing published Test content stays visible.
ALTER TABLE "test_questions"
ADD COLUMN "published_at" TIMESTAMP(3);

UPDATE "test_questions" AS question
SET "published_at" = question."updated_at"
FROM "test_sets" AS test_set
WHERE question."test_set_id" = test_set."id"
  AND question."deleted_at" IS NULL
  AND question."review_status" = 'APPROVED'
  AND test_set."deleted_at" IS NULL
  AND test_set."review_status" = 'APPROVED';

CREATE INDEX "test_questions_test_set_id_published_at_idx"
ON "test_questions"("test_set_id", "published_at");
