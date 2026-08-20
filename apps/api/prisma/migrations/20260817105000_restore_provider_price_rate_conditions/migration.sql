-- Price changes must not erase technical routing conditions such as
-- maxInputTokens. Restore missing conditions on each current rate from the
-- newest historical rate with the same catalog item, metric and tier.
UPDATE "provider_price_rates" AS current_rate
SET "conditions_json" = (
  SELECT previous_rate."conditions_json"
  FROM "provider_price_versions" AS current_version
  JOIN "provider_price_versions" AS previous_version
    ON previous_version."catalog_item_id" = current_version."catalog_item_id"
   AND previous_version."effective_from" < current_version."effective_from"
  JOIN "provider_price_rates" AS previous_rate
    ON previous_rate."price_version_id" = previous_version."id"
   AND previous_rate."metric" = current_rate."metric"
   AND previous_rate."tier_from" IS NOT DISTINCT FROM current_rate."tier_from"
   AND previous_rate."tier_to" IS NOT DISTINCT FROM current_rate."tier_to"
  WHERE current_version."id" = current_rate."price_version_id"
    AND previous_rate."conditions_json" ? 'maxInputTokens'
  ORDER BY previous_version."effective_from" DESC
  LIMIT 1
)
WHERE current_rate."price_version_id" IN (
  SELECT current_version."id"
  FROM "provider_price_versions" AS current_version
  WHERE current_version."effective_to" IS NULL
)
AND NOT COALESCE(current_rate."conditions_json", '{}'::jsonb) ? 'maxInputTokens'
AND EXISTS (
  SELECT 1
  FROM "provider_price_versions" AS current_version
  JOIN "provider_price_versions" AS previous_version
    ON previous_version."catalog_item_id" = current_version."catalog_item_id"
   AND previous_version."effective_from" < current_version."effective_from"
  JOIN "provider_price_rates" AS previous_rate
    ON previous_rate."price_version_id" = previous_version."id"
   AND previous_rate."metric" = current_rate."metric"
   AND previous_rate."tier_from" IS NOT DISTINCT FROM current_rate."tier_from"
   AND previous_rate."tier_to" IS NOT DISTINCT FROM current_rate."tier_to"
  WHERE current_version."id" = current_rate."price_version_id"
    AND previous_rate."conditions_json" ? 'maxInputTokens'
);
