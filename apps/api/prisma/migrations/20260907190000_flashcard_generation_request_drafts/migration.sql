CREATE TABLE "flashcard_generation_request_drafts" (
  "id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "created_by_id" UUID,
  "request_hash" TEXT NOT NULL,
  "system_instructions" TEXT NOT NULL,
  "user_prompt" TEXT NOT NULL,
  "schema_name" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "schema_hash" TEXT NOT NULL,
  "schema_json" JSONB NOT NULL,
  "source_snapshot_json" JSONB NOT NULL,
  "model_config_json" JSONB NOT NULL,
  "cost_estimate_json" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "flashcard_generation_request_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flashcard_generation_request_drafts_lesson_id_created_at_idx"
ON "flashcard_generation_request_drafts"("lesson_id", "created_at" DESC);

CREATE INDEX "flashcard_generation_request_drafts_request_hash_idx"
ON "flashcard_generation_request_drafts"("request_hash");

CREATE INDEX "flashcard_generation_request_drafts_expires_at_idx"
ON "flashcard_generation_request_drafts"("expires_at");

ALTER TABLE "flashcard_generation_request_drafts"
ADD CONSTRAINT "flashcard_generation_request_drafts_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
