-- M9.12 reserves a conservative AI upper bound before a paid call. Historical
-- catalog refreshes could create active price rates without maxInputTokens, and
-- the earlier history-based repair cannot recover a value when every prior
-- version is also missing it. Backfill only missing limits and preserve any
-- stricter limit already configured for a model.
WITH model_input_limits("provider", "external_key", "max_input_tokens") AS (
  VALUES
    ('OPENAI', 'gpt-5.6-sol', 272000),
    ('OPENAI', 'gpt-5.6-terra', 272000),
    ('OPENAI', 'gpt-5.6-luna', 272000),
    ('OPENAI', 'gpt-5.4', 272000),
    ('OPENAI', 'gpt-5.4-mini', 400000),
    ('OPENAI', 'gpt-5.4-nano', 400000),
    ('OPENAI', 'gpt-5.2', 400000),
    ('OPENAI', 'gpt-5.1', 400000),
    ('OPENAI', 'gpt-5-mini', 400000),
    ('OPENAI', 'gpt-5-nano', 400000),
    ('OPENAI', 'gpt-4.1', 1047576),
    ('OPENAI', 'gpt-4.1-mini', 1047576),
    ('OPENAI', 'gpt-4.1-nano', 1047576),
    ('GEMINI', 'gemini-3.6-flash', 200000),
    ('GEMINI', 'gemini-3.5-flash', 200000),
    ('GEMINI', 'gemini-3.5-flash-lite', 200000),
    ('GEMINI', 'gemini-3.1-flash-lite', 200000),
    ('GEMINI', 'gemini-2.5-pro', 200000),
    ('GEMINI', 'gemini-2.5-flash', 200000),
    ('GEMINI', 'gemini-2.5-flash-lite', 200000)
)
UPDATE "provider_price_rates" AS rate
SET "conditions_json" = COALESCE(rate."conditions_json", '{}'::jsonb)
  || jsonb_build_object('maxInputTokens', limits."max_input_tokens")
FROM "provider_price_versions" AS price
JOIN "provider_catalog_items" AS item
  ON item."id" = price."catalog_item_id"
JOIN model_input_limits AS limits
  ON limits."provider" = item."provider"
 AND limits."external_key" = item."external_key"
WHERE rate."price_version_id" = price."id"
  AND price."effective_from" <= CURRENT_TIMESTAMP
  AND (price."effective_to" IS NULL OR price."effective_to" > CURRENT_TIMESTAMP)
  AND item."category" = 'AI_MODEL'
  AND NOT COALESCE(rate."conditions_json", '{}'::jsonb) ? 'maxInputTokens';
