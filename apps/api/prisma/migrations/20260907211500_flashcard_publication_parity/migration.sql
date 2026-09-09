ALTER TABLE "flashcards"
ADD COLUMN "published_at" TIMESTAMP(3);

UPDATE "flashcards"
SET "published_at" = COALESCE("updated_at", "created_at")
WHERE "review_status" = 'APPROVED'
  AND "deleted_at" IS NULL;

CREATE INDEX "flashcards_flashcard_set_id_published_at_idx"
ON "flashcards"("flashcard_set_id", "published_at");
