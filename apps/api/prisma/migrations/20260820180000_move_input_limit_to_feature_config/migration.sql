ALTER TABLE "ai_feature_model_configs"
ADD COLUMN "max_input_tokens" INTEGER;

-- Preserve the operational cap once while moving ownership from model catalog
-- to each AI feature configuration. Use a conservative general default when
-- an older catalog item has no recoverable cap.
UPDATE "ai_feature_model_configs" AS config
SET "max_input_tokens" = COALESCE(item."max_input_tokens", 200000)
FROM "provider_catalog_items" AS item
WHERE item."id" = config."primary_catalog_item_id";

ALTER TABLE "ai_feature_model_configs"
ADD CONSTRAINT "ai_feature_model_configs_max_input_tokens_check"
CHECK ("max_input_tokens" IS NULL OR "max_input_tokens" BETWEEN 128 AND 2000000);

ALTER TABLE "provider_catalog_items"
DROP CONSTRAINT "provider_catalog_items_context_window_tokens_check",
DROP CONSTRAINT "provider_catalog_items_max_input_tokens_check",
DROP CONSTRAINT "provider_catalog_items_input_within_context_check",
DROP COLUMN "context_window_tokens",
DROP COLUMN "max_input_tokens";
