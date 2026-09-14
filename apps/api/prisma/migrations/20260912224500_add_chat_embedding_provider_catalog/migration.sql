-- Chat uses a text-generation request plus one optional query embedding. Keep
-- both calls inside the provider catalog so budget reservation and measured
-- usage cover the complete RAG turn.

UPDATE "provider_catalog_items"
SET "capabilities_json" = CASE
      WHEN jsonb_typeof("capabilities_json"::jsonb) = 'array' THEN
        jsonb_build_object(
          'features',
          COALESCE("capabilities_json"::jsonb, '[]'::jsonb) || '["CHAT"]'::jsonb
        )
      WHEN jsonb_typeof("capabilities_json"::jsonb) = 'object' THEN
        jsonb_set(
          "capabilities_json"::jsonb,
          '{features}',
          COALESCE("capabilities_json"::jsonb -> 'features', '[]'::jsonb) || '["CHAT"]'::jsonb,
          true
        )
      ELSE jsonb_build_object('features', jsonb_build_array('CHAT'))
    END,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "category" = 'AI_MODEL'
  AND "external_key" NOT LIKE 'text-embedding-%'
  AND NOT (
    CASE
      WHEN jsonb_typeof("capabilities_json"::jsonb) = 'array'
        THEN "capabilities_json"::jsonb
      WHEN jsonb_typeof("capabilities_json"::jsonb) = 'object'
        THEN COALESCE("capabilities_json"::jsonb -> 'features', '[]'::jsonb)
      ELSE '[]'::jsonb
    END @> '["CHAT"]'::jsonb
  );

INSERT INTO "provider_catalog_items" (
  "category",
  "provider",
  "external_key",
  "display_name",
  "capabilities_json",
  "status",
  "credential_env_var",
  "updated_at"
) VALUES (
  'AI_MODEL',
  'OPENAI',
  'text-embedding-3-small',
  'Text Embedding 3 Small',
  '{"features":["EMBEDDING"],"dimensions":[1536]}'::jsonb,
  'ACTIVE',
  'OPENAI_API_KEY',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("category", "provider", "external_key") DO UPDATE SET
  "display_name" = EXCLUDED."display_name",
  "capabilities_json" = EXCLUDED."capabilities_json",
  "status" = EXCLUDED."status",
  "deprecation_note" = NULL,
  "credential_env_var" = EXCLUDED."credential_env_var",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "provider_price_versions" (
  "catalog_item_id",
  "billing_mode",
  "source_url",
  "effective_from"
)
SELECT
  item."id",
  'TOKEN',
  'https://developers.openai.com/api/docs/models/text-embedding-3-small',
  TIMESTAMP '2026-09-12 00:00:00'
FROM "provider_catalog_items" item
WHERE item."category" = 'AI_MODEL'
  AND item."provider" = 'OPENAI'
  AND item."external_key" = 'text-embedding-3-small'
  AND NOT EXISTS (
    SELECT 1
    FROM "provider_price_versions" existing
    WHERE existing."catalog_item_id" = item."id"
      AND existing."effective_from" = TIMESTAMP '2026-09-12 00:00:00'
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
  'INPUT_TOKEN',
  1000000,
  0.02,
  '{"serviceTier":"STANDARD"}'::jsonb
FROM "provider_catalog_items" item
JOIN "provider_price_versions" price
  ON price."catalog_item_id" = item."id"
  AND price."effective_from" = TIMESTAMP '2026-09-12 00:00:00'
WHERE item."category" = 'AI_MODEL'
  AND item."provider" = 'OPENAI'
  AND item."external_key" = 'text-embedding-3-small'
  AND NOT EXISTS (
    SELECT 1
    FROM "provider_price_rates" existing
    WHERE existing."price_version_id" = price."id"
      AND existing."metric" = 'INPUT_TOKEN'
  );
