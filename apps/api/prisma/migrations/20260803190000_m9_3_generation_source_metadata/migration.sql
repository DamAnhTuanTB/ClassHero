ALTER TABLE "quiz_questions"
ADD COLUMN "source_metadata_json" JSONB;

ALTER TABLE "flashcards"
ADD COLUMN "source_metadata_json" JSONB;

ALTER TABLE "test_questions"
ADD COLUMN "source_metadata_json" JSONB;
