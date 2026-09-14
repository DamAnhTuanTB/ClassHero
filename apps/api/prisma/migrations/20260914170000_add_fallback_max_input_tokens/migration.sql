ALTER TABLE "ai_feature_model_configs"
ADD COLUMN "fallback_max_input_tokens" INTEGER;

UPDATE "ai_feature_model_configs"
SET "fallback_max_input_tokens" = "max_input_tokens"
WHERE "fallback_catalog_item_id" IS NOT NULL;
