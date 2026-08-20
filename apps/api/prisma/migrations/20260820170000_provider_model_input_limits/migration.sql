ALTER TABLE "provider_catalog_items"
ADD COLUMN "context_window_tokens" INTEGER,
ADD COLUMN "max_input_tokens" INTEGER;

-- Preserve the current operational cap before price-rate metadata becomes legacy.
WITH ranked_limits AS (
  SELECT
    item."id" AS "catalog_item_id",
    (rate."conditions_json"->>'maxInputTokens')::INTEGER AS "max_input_tokens",
    ROW_NUMBER() OVER (
      PARTITION BY item."id"
      ORDER BY version."effective_from" DESC, version."created_at" DESC, rate."id"
    ) AS "position"
  FROM "provider_catalog_items" item
  JOIN "provider_price_versions" version
    ON version."catalog_item_id" = item."id"
  JOIN "provider_price_rates" rate
    ON rate."price_version_id" = version."id"
  WHERE item."category" = 'AI_MODEL'
    AND rate."conditions_json"->>'maxInputTokens' ~ '^[1-9][0-9]*$'
    AND (rate."conditions_json"->>'maxInputTokens')::BIGINT <= 2147483647
)
UPDATE "provider_catalog_items" item
SET "max_input_tokens" = ranked."max_input_tokens"
FROM ranked_limits ranked
WHERE ranked."catalog_item_id" = item."id"
  AND ranked."position" = 1;

-- Verified provider context windows for the OpenAI catalog known at rollout.
UPDATE "provider_catalog_items"
SET "context_window_tokens" = CASE
  WHEN "external_key" IN ('gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4')
    THEN 1050000
  WHEN "external_key" IN ('gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.2', 'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano')
    THEN 400000
  WHEN "external_key" IN ('gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano')
    THEN 1047576
  ELSE NULL
END
WHERE "category" = 'AI_MODEL'
  AND "provider" = 'OPENAI';

-- A legacy operational cap cannot exceed the provider's technical context.
UPDATE "provider_catalog_items"
SET "max_input_tokens" = LEAST("max_input_tokens", "context_window_tokens")
WHERE "max_input_tokens" IS NOT NULL
  AND "context_window_tokens" IS NOT NULL;

ALTER TABLE "provider_catalog_items"
ADD CONSTRAINT "provider_catalog_items_context_window_tokens_check"
CHECK ("context_window_tokens" IS NULL OR "context_window_tokens" > 0),
ADD CONSTRAINT "provider_catalog_items_max_input_tokens_check"
CHECK ("max_input_tokens" IS NULL OR "max_input_tokens" > 0),
ADD CONSTRAINT "provider_catalog_items_input_within_context_check"
CHECK (
  "context_window_tokens" IS NULL
  OR "max_input_tokens" IS NULL
  OR "max_input_tokens" <= "context_window_tokens"
);
