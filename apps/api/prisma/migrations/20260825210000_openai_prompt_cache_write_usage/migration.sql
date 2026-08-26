ALTER TABLE "provider_usage_events"
ADD COLUMN "cache_write_input_tokens" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "provider_usage_events"
DROP CONSTRAINT "provider_usage_nonnegative";

ALTER TABLE "provider_usage_events"
ADD CONSTRAINT "provider_usage_nonnegative" CHECK (
  "prompt_tokens" >= 0 AND "cached_input_tokens" >= 0 AND
  "cache_write_input_tokens" >= 0 AND "completion_tokens" >= 0 AND
  "total_tokens" >= 0 AND "pages" >= 0 AND "request_count" >= 0 AND
  "cost_vnd" >= 0 AND "estimated_saved_cost_vnd" >= 0
);
