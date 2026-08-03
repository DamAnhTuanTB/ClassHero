-- Provider operations foundation: versioned pricing, feature routing, usage and budgets.
CREATE TYPE "ProviderCatalogCategory" AS ENUM ('AI_MODEL', 'OCR_SERVICE');
CREATE TYPE "ProviderCatalogStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'DISABLED');
CREATE TYPE "ProviderBillingMode" AS ENUM ('TOKEN', 'PAGE', 'REQUEST');
CREATE TYPE "ProviderUsageMetric" AS ENUM ('INPUT_TOKEN', 'CACHED_INPUT_TOKEN', 'OUTPUT_TOKEN', 'PAGE', 'REQUEST');
CREATE TYPE "ProviderUsageStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ProviderUsageSource" AS ENUM ('MEASURED', 'RECONSTRUCTED');
CREATE TYPE "ProviderBudgetScope" AS ENUM ('ALL', 'AI', 'OCR');

CREATE TABLE "provider_catalog_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category" "ProviderCatalogCategory" NOT NULL,
  "provider" TEXT NOT NULL,
  "external_key" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "capabilities_json" JSONB,
  "status" "ProviderCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
  "deprecation_note" TEXT,
  "credential_env_var" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_price_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "catalog_item_id" UUID NOT NULL,
  "billing_mode" "ProviderBillingMode" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "source_url" TEXT,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_price_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_price_rates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "price_version_id" UUID NOT NULL,
  "metric" "ProviderUsageMetric" NOT NULL,
  "unit_size" DECIMAL(20,6) NOT NULL DEFAULT 1,
  "unit_price_usd" DECIMAL(20,10) NOT NULL,
  "tier_from" INTEGER,
  "tier_to" INTEGER,
  "conditions_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_price_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_feature_model_configs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "feature" "AiGenerationType" NOT NULL,
  "primary_catalog_item_id" UUID NOT NULL,
  "fallback_catalog_item_id" UUID,
  "temperature" DECIMAL(4,3),
  "max_output_tokens" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_feature_model_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_feature_model_configs_distinct_models" CHECK ("fallback_catalog_item_id" IS NULL OR "fallback_catalog_item_id" <> "primary_catalog_item_id")
);

CREATE TABLE "provider_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "category" "ProviderCatalogCategory" NOT NULL,
  "provider" TEXT NOT NULL,
  "catalog_item_id" UUID,
  "price_version_id" UUID,
  "ai_generation_id" UUID,
  "background_job_id" UUID,
  "source_document_id" UUID,
  "feature" "AiGenerationType",
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "provider_request_id" TEXT,
  "status" "ProviderUsageStatus" NOT NULL DEFAULT 'RUNNING',
  "source" "ProviderUsageSource" NOT NULL DEFAULT 'MEASURED',
  "cache_status" TEXT,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "pages" INTEGER NOT NULL DEFAULT 0,
  "request_count" INTEGER NOT NULL DEFAULT 1,
  "raw_usage_json" JSONB,
  "estimated_cost_usd" DECIMAL(20,10) NOT NULL DEFAULT 0,
  "cost_vnd" INTEGER NOT NULL DEFAULT 0,
  "fx_rate_vnd_per_usd" DECIMAL(12,4) NOT NULL DEFAULT 25000,
  "estimated_saved_cost_usd" DECIMAL(20,10) NOT NULL DEFAULT 0,
  "estimated_saved_cost_vnd" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "error_code" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_usage_nonnegative" CHECK (
    "prompt_tokens" >= 0 AND "cached_input_tokens" >= 0 AND
    "completion_tokens" >= 0 AND "total_tokens" >= 0 AND "pages" >= 0 AND
    "request_count" >= 0 AND "cost_vnd" >= 0 AND "estimated_saved_cost_vnd" >= 0
  )
);

CREATE TABLE "provider_budget_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" "ProviderBudgetScope" NOT NULL,
  "monthly_limit_vnd" INTEGER NOT NULL,
  "warning_thresholds_json" JSONB NOT NULL DEFAULT '[70,90,100]',
  "hard_stop" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_budget_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_budget_nonnegative" CHECK ("monthly_limit_vnd" >= 0)
);

CREATE TABLE "provider_accounting_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "singleton_key" TEXT NOT NULL DEFAULT 'default',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "week_starts_on" INTEGER NOT NULL DEFAULT 1,
  "fx_rate_vnd_per_usd" DECIMAL(12,4) NOT NULL DEFAULT 25000,
  "price_freshness_days" INTEGER NOT NULL DEFAULT 90,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_accounting_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_accounting_week_start" CHECK ("week_starts_on" BETWEEN 0 AND 6),
  CONSTRAINT "provider_accounting_fx_positive" CHECK ("fx_rate_vnd_per_usd" > 0)
);

CREATE UNIQUE INDEX "provider_catalog_items_category_provider_external_key_key" ON "provider_catalog_items"("category", "provider", "external_key");
CREATE INDEX "provider_catalog_items_category_status_idx" ON "provider_catalog_items"("category", "status");
CREATE INDEX "provider_catalog_items_provider_status_idx" ON "provider_catalog_items"("provider", "status");
CREATE INDEX "provider_price_versions_catalog_item_id_effective_from_idx" ON "provider_price_versions"("catalog_item_id", "effective_from");
CREATE INDEX "provider_price_versions_effective_from_effective_to_idx" ON "provider_price_versions"("effective_from", "effective_to");
CREATE INDEX "provider_price_rates_price_version_id_metric_idx" ON "provider_price_rates"("price_version_id", "metric");
CREATE UNIQUE INDEX "ai_feature_model_configs_feature_key" ON "ai_feature_model_configs"("feature");
CREATE INDEX "ai_feature_model_configs_primary_catalog_item_id_idx" ON "ai_feature_model_configs"("primary_catalog_item_id");
CREATE INDEX "ai_feature_model_configs_fallback_catalog_item_id_idx" ON "ai_feature_model_configs"("fallback_catalog_item_id");
CREATE INDEX "provider_usage_events_created_at_idx" ON "provider_usage_events"("created_at");
CREATE INDEX "provider_usage_events_category_created_at_idx" ON "provider_usage_events"("category", "created_at");
CREATE INDEX "provider_usage_events_provider_catalog_item_id_created_at_idx" ON "provider_usage_events"("provider", "catalog_item_id", "created_at");
CREATE INDEX "provider_usage_events_feature_created_at_idx" ON "provider_usage_events"("feature", "created_at");
CREATE INDEX "provider_usage_events_status_created_at_idx" ON "provider_usage_events"("status", "created_at");
CREATE INDEX "provider_usage_events_ai_generation_id_idx" ON "provider_usage_events"("ai_generation_id");
CREATE INDEX "provider_usage_events_background_job_id_idx" ON "provider_usage_events"("background_job_id");
CREATE INDEX "provider_usage_events_source_document_id_idx" ON "provider_usage_events"("source_document_id");
CREATE UNIQUE INDEX "provider_budget_policies_scope_key" ON "provider_budget_policies"("scope");
CREATE UNIQUE INDEX "provider_accounting_settings_singleton_key_key" ON "provider_accounting_settings"("singleton_key");

ALTER TABLE "provider_price_versions" ADD CONSTRAINT "provider_price_versions_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "provider_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_price_rates" ADD CONSTRAINT "provider_price_rates_price_version_id_fkey" FOREIGN KEY ("price_version_id") REFERENCES "provider_price_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_feature_model_configs" ADD CONSTRAINT "ai_feature_model_configs_primary_catalog_item_id_fkey" FOREIGN KEY ("primary_catalog_item_id") REFERENCES "provider_catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_feature_model_configs" ADD CONSTRAINT "ai_feature_model_configs_fallback_catalog_item_id_fkey" FOREIGN KEY ("fallback_catalog_item_id") REFERENCES "provider_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "provider_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_price_version_id_fkey" FOREIGN KEY ("price_version_id") REFERENCES "provider_price_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_background_job_id_fkey" FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Safe defaults. Prices are editable/versioned and retain their official source URL.
INSERT INTO "provider_catalog_items" ("category", "provider", "external_key", "display_name", "capabilities_json", "credential_env_var", "updated_at") VALUES
  ('AI_MODEL', 'OPENAI', 'gpt-4.1-mini', 'GPT-4.1 mini', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'OPENAI_API_KEY', CURRENT_TIMESTAMP),
  ('AI_MODEL', 'GEMINI', 'gemini-2.5-flash', 'Gemini 2.5 Flash', '["SUMMARY","QUIZ","FLASHCARD","TEST"]', 'GEMINI_API_KEY', CURRENT_TIMESTAMP),
  ('OCR_SERVICE', 'MATHPIX', 'mathpix-v3-pdf', 'Mathpix PDF OCR', '["OCR"]', 'MATHPIX_APP_ID', CURRENT_TIMESTAMP);

INSERT INTO "provider_price_versions" ("catalog_item_id", "billing_mode", "source_url", "effective_from")
SELECT "id", 'TOKEN', 'https://developers.openai.com/api/docs/pricing', TIMESTAMP '2026-08-03 00:00:00' FROM "provider_catalog_items" WHERE "provider" = 'OPENAI';
INSERT INTO "provider_price_versions" ("catalog_item_id", "billing_mode", "source_url", "effective_from")
SELECT "id", 'TOKEN', 'https://ai.google.dev/gemini-api/docs/pricing', TIMESTAMP '2026-08-03 00:00:00' FROM "provider_catalog_items" WHERE "provider" = 'GEMINI';
INSERT INTO "provider_price_versions" ("catalog_item_id", "billing_mode", "source_url", "effective_from")
SELECT "id", 'PAGE', 'https://mathpix.com/pricing/api', TIMESTAMP '2026-08-03 00:00:00' FROM "provider_catalog_items" WHERE "provider" = 'MATHPIX';

INSERT INTO "provider_price_rates" ("price_version_id", "metric", "unit_size", "unit_price_usd")
SELECT pv."id", rate.metric::"ProviderUsageMetric", 1000000, rate.price
FROM "provider_price_versions" pv
JOIN "provider_catalog_items" ci ON ci."id" = pv."catalog_item_id"
CROSS JOIN (VALUES ('INPUT_TOKEN', 0.40), ('CACHED_INPUT_TOKEN', 0.10), ('OUTPUT_TOKEN', 1.60)) AS rate(metric, price)
WHERE ci."provider" = 'OPENAI';

INSERT INTO "provider_price_rates" ("price_version_id", "metric", "unit_size", "unit_price_usd")
SELECT pv."id", rate.metric::"ProviderUsageMetric", 1000000, rate.price
FROM "provider_price_versions" pv
JOIN "provider_catalog_items" ci ON ci."id" = pv."catalog_item_id"
CROSS JOIN (VALUES ('INPUT_TOKEN', 0.30), ('CACHED_INPUT_TOKEN', 0.03), ('OUTPUT_TOKEN', 2.50)) AS rate(metric, price)
WHERE ci."provider" = 'GEMINI';

INSERT INTO "provider_price_rates" ("price_version_id", "metric", "unit_size", "unit_price_usd", "tier_from", "tier_to")
SELECT pv."id", 'PAGE', 1, 0.005, 0, NULL
FROM "provider_price_versions" pv
JOIN "provider_catalog_items" ci ON ci."id" = pv."catalog_item_id"
WHERE ci."provider" = 'MATHPIX';

INSERT INTO "ai_feature_model_configs" ("feature", "primary_catalog_item_id", "fallback_catalog_item_id", "temperature", "max_output_tokens", "updated_at")
SELECT feature::"AiGenerationType", openai."id", gemini."id", 0.2, max_tokens, CURRENT_TIMESTAMP
FROM (VALUES ('SUMMARY', 3500), ('QUIZ', 5000), ('FLASHCARD', 4000), ('TEST', 6000)) AS config(feature, max_tokens)
CROSS JOIN (SELECT "id" FROM "provider_catalog_items" WHERE "provider" = 'OPENAI') openai
CROSS JOIN (SELECT "id" FROM "provider_catalog_items" WHERE "provider" = 'GEMINI') gemini;

INSERT INTO "provider_budget_policies" ("scope", "monthly_limit_vnd", "updated_at") VALUES
  ('ALL', 2000000, CURRENT_TIMESTAMP),
  ('AI', 1500000, CURRENT_TIMESTAMP),
  ('OCR', 1000000, CURRENT_TIMESTAMP);

INSERT INTO "provider_accounting_settings" ("updated_at") VALUES (CURRENT_TIMESTAMP);
