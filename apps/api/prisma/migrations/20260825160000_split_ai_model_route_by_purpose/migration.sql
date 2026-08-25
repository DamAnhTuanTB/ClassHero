CREATE TYPE "AiModelPurpose" AS ENUM ('TEXT', 'IMAGE');

ALTER TABLE "provider_usage_events"
ADD COLUMN "purpose" "AiModelPurpose";

ALTER TABLE "ai_feature_model_configs"
ADD COLUMN "purpose" "AiModelPurpose" NOT NULL DEFAULT 'TEXT';

DROP INDEX "ai_feature_model_configs_feature_key";

INSERT INTO "ai_feature_model_configs" (
  "id",
  "feature",
  "purpose",
  "primary_catalog_item_id",
  "fallback_catalog_item_id",
  "temperature",
  "reasoning_effort",
  "max_input_tokens",
  "max_output_tokens",
  "fallback_temperature",
  "fallback_reasoning_effort",
  "fallback_max_output_tokens",
  "version",
  "updated_by_user_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  "feature",
  'IMAGE'::"AiModelPurpose",
  "primary_catalog_item_id",
  "fallback_catalog_item_id",
  "temperature",
  "reasoning_effort",
  "max_input_tokens",
  "max_output_tokens",
  "fallback_temperature",
  "fallback_reasoning_effort",
  "fallback_max_output_tokens",
  "version",
  "updated_by_user_id",
  "created_at",
  "updated_at"
FROM "ai_feature_model_configs";

CREATE UNIQUE INDEX "ai_feature_model_configs_feature_purpose_key"
ON "ai_feature_model_configs"("feature", "purpose");
