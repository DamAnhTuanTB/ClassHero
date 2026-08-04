-- Expand the production-safe text/structured-output model picker.
-- Only stable API models are included; preview, audio, image and deprecated models stay out.
INSERT INTO "provider_catalog_items" (
  "category",
  "provider",
  "external_key",
  "display_name",
  "capabilities_json",
  "status",
  "credential_env_var",
  "updated_at"
) VALUES
  ('AI_MODEL', 'OPENAI', 'gpt-5.6-sol', 'GPT-5.6 Sol', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-5.6-terra', 'GPT-5.6 Terra', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-5.6-luna', 'GPT-5.6 Luna', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-5.4', 'GPT-5.4', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-5.4-mini', 'GPT-5.4 mini', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-5.4-nano', 'GPT-5.4 nano', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-4.1', 'GPT-4.1', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-4.1-mini', 'GPT-4.1 mini', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'OPENAI', 'gpt-4.1-nano', 'GPT-4.1 nano', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-3.6-flash', 'Gemini 3.6 Flash', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'GEMINI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-3.5-flash', 'Gemini 3.5 Flash', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'GEMINI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'GEMINI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'GEMINI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-2.5-pro', 'Gemini 2.5 Pro', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'GEMINI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-2.5-flash', 'Gemini 2.5 Flash', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'GEMINI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'ACTIVE', 'GEMINI_API_KEY', CURRENT_TIMESTAMP)
ON CONFLICT ("category", "provider", "external_key") DO UPDATE SET
  "display_name" = EXCLUDED."display_name",
  "capabilities_json" = EXCLUDED."capabilities_json",
  "status" = EXCLUDED."status",
  "deprecation_note" = NULL,
  "credential_env_var" = EXCLUDED."credential_env_var",
  "updated_at" = CURRENT_TIMESTAMP;

-- Standard synchronous pricing. The application keeps AI generation input below
-- 200K tokens, so the short-context tier is the relevant accounting tier.
INSERT INTO "provider_price_versions" (
  "catalog_item_id",
  "billing_mode",
  "source_url",
  "effective_from"
)
SELECT
  item."id",
  'TOKEN',
  CASE
    WHEN item."provider" = 'OPENAI' THEN 'https://developers.openai.com/api/docs/pricing'
    ELSE 'https://ai.google.dev/gemini-api/docs/pricing'
  END,
  TIMESTAMP '2026-08-03 00:00:00'
FROM "provider_catalog_items" item
WHERE item."category" = 'AI_MODEL'
  AND item."external_key" IN (
    'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
    'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano',
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
    'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  );

INSERT INTO "provider_price_rates" (
  "price_version_id",
  "metric",
  "unit_size",
  "unit_price_usd",
  "conditions_json"
)
SELECT
  price."id",
  rate."metric"::"ProviderUsageMetric",
  1000000,
  rate."unit_price_usd",
  jsonb_build_object(
    'serviceTier', 'STANDARD',
    'contextTier', 'SHORT',
    'maxInputTokens', model_price."max_input_tokens"
  )
FROM (
  VALUES
    ('OPENAI', 'gpt-5.6-sol', 5.00::numeric, 0.50::numeric, 30.00::numeric, 272000),
    ('OPENAI', 'gpt-5.6-terra', 2.00::numeric, 0.20::numeric, 12.00::numeric, 272000),
    ('OPENAI', 'gpt-5.6-luna', 0.20::numeric, 0.02::numeric, 1.20::numeric, 272000),
    ('OPENAI', 'gpt-5.4', 2.50::numeric, 0.25::numeric, 15.00::numeric, 272000),
    ('OPENAI', 'gpt-5.4-mini', 0.75::numeric, 0.075::numeric, 4.50::numeric, 272000),
    ('OPENAI', 'gpt-5.4-nano', 0.20::numeric, 0.02::numeric, 1.25::numeric, 272000),
    ('OPENAI', 'gpt-4.1', 2.00::numeric, 0.50::numeric, 8.00::numeric, 272000),
    ('OPENAI', 'gpt-4.1-mini', 0.40::numeric, 0.10::numeric, 1.60::numeric, 272000),
    ('OPENAI', 'gpt-4.1-nano', 0.10::numeric, 0.025::numeric, 0.40::numeric, 272000),
    ('GEMINI', 'gemini-3.6-flash', 1.50::numeric, 0.15::numeric, 7.50::numeric, 200000),
    ('GEMINI', 'gemini-3.5-flash', 1.50::numeric, 0.15::numeric, 9.00::numeric, 200000),
    ('GEMINI', 'gemini-3.5-flash-lite', 0.30::numeric, 0.03::numeric, 2.50::numeric, 200000),
    ('GEMINI', 'gemini-3.1-flash-lite', 0.25::numeric, 0.025::numeric, 1.50::numeric, 200000),
    ('GEMINI', 'gemini-2.5-pro', 1.25::numeric, 0.125::numeric, 10.00::numeric, 200000),
    ('GEMINI', 'gemini-2.5-flash', 0.30::numeric, 0.03::numeric, 2.50::numeric, 200000),
    ('GEMINI', 'gemini-2.5-flash-lite', 0.10::numeric, 0.01::numeric, 0.40::numeric, 200000)
) AS model_price(
  "provider",
  "external_key",
  "input_price",
  "cached_input_price",
  "output_price",
  "max_input_tokens"
)
JOIN "provider_catalog_items" item
  ON item."provider" = model_price."provider"
  AND item."external_key" = model_price."external_key"
JOIN "provider_price_versions" price
  ON price."catalog_item_id" = item."id"
  AND price."effective_from" = TIMESTAMP '2026-08-03 00:00:00'
CROSS JOIN LATERAL (
  VALUES
    ('INPUT_TOKEN', model_price."input_price"),
    ('CACHED_INPUT_TOKEN', model_price."cached_input_price"),
    ('OUTPUT_TOKEN', model_price."output_price")
) AS rate("metric", "unit_price_usd");
