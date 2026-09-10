ALTER TYPE "AiGenerationType" ADD VALUE IF NOT EXISTS 'VIDEO_SUMMARY';

CREATE TABLE "lesson_video_summary_request_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "created_by_id" UUID,
    "request_hash" TEXT NOT NULL,
    "source_snapshot_json" JSONB NOT NULL,
    "system_instructions" TEXT NOT NULL,
    "user_prompt" TEXT NOT NULL,
    "schema_name" TEXT NOT NULL,
    "schema_version" TEXT NOT NULL,
    "schema_hash" TEXT NOT NULL,
    "schema_json" JSONB NOT NULL,
    "model_config_json" JSONB NOT NULL,
    "cost_estimate_json" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lesson_video_summary_request_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lesson_video_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "content_json" JSONB NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "ai_generation_id" UUID,
    "source_video_url_hash" TEXT,
    "source_transcript_hash" TEXT,
    "source_chapters_hash" TEXT,
    "source_player_settings_hash" TEXT,
    "stale_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "lesson_video_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_video_summaries_lesson_id_key" ON "lesson_video_summaries"("lesson_id");
CREATE INDEX "lesson_video_summaries_ai_generation_id_idx" ON "lesson_video_summaries"("ai_generation_id");
CREATE INDEX "lesson_video_summary_request_drafts_lesson_id_created_at_idx" ON "lesson_video_summary_request_drafts"("lesson_id", "created_at" DESC);
CREATE INDEX "lesson_video_summary_request_drafts_request_hash_idx" ON "lesson_video_summary_request_drafts"("request_hash");
CREATE INDEX "lesson_video_summary_request_drafts_expires_at_idx" ON "lesson_video_summary_request_drafts"("expires_at");

ALTER TABLE "lesson_video_summary_request_drafts" ADD CONSTRAINT "lesson_video_summary_request_drafts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_video_summaries" ADD CONSTRAINT "lesson_video_summaries_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_video_summaries" ADD CONSTRAINT "lesson_video_summaries_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lesson_video_summaries" ADD CONSTRAINT "lesson_video_summaries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lesson_video_summaries" ADD CONSTRAINT "lesson_video_summaries_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ai_feature_model_configs" (
  "id", "feature", "purpose", "primary_catalog_item_id", "fallback_catalog_item_id",
  "temperature", "reasoning_effort", "max_input_tokens", "max_output_tokens",
  "fallback_temperature", "fallback_reasoning_effort", "fallback_max_output_tokens",
  "version", "updated_by_user_id", "created_at", "updated_at"
)
SELECT gen_random_uuid(), 'VIDEO_SUMMARY'::"AiGenerationType", 'TEXT'::"AiModelPurpose",
  "primary_catalog_item_id", "fallback_catalog_item_id", "temperature", "reasoning_effort",
  "max_input_tokens", "max_output_tokens", "fallback_temperature", "fallback_reasoning_effort",
  "fallback_max_output_tokens", "version", "updated_by_user_id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ai_feature_model_configs"
WHERE "feature" = 'SUMMARY'::"AiGenerationType" AND "purpose" = 'TEXT'::"AiModelPurpose"
ON CONFLICT ("feature", "purpose") DO NOTHING;
