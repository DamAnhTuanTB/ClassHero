-- Repair the canonical migration chain for AI feature generation controls.
-- Some existing environments already received these columns before the
-- migration was recorded, so keep the migration safe for both fresh and
-- already-initialized databases.
ALTER TABLE "ai_feature_model_configs"
ADD COLUMN IF NOT EXISTS "reasoning_effort" TEXT,
ADD COLUMN IF NOT EXISTS "fallback_temperature" DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS "fallback_reasoning_effort" TEXT,
ADD COLUMN IF NOT EXISTS "fallback_max_output_tokens" INTEGER;
