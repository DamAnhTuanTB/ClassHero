CREATE TYPE "ProviderBudgetReservationStatus" AS ENUM (
  'RESERVED',
  'SETTLED',
  'RELEASED',
  'UNCERTAIN'
);

CREATE TABLE "provider_budget_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idempotency_key" TEXT NOT NULL,
  "period_key" VARCHAR(7) NOT NULL,
  "category" "ProviderCatalogCategory" NOT NULL,
  "status" "ProviderBudgetReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "reserved_vnd" INTEGER NOT NULL,
  "settled_vnd" INTEGER NOT NULL DEFAULT 0,
  "usage_event_id" UUID NOT NULL,
  "background_job_id" UUID,
  "ai_generation_id" UUID,
  "source_document_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "settled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_budget_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_budget_reservation_amounts_nonnegative" CHECK (
    "reserved_vnd" >= 0 AND "settled_vnd" >= 0
  ),
  CONSTRAINT "provider_budget_reservation_period_key_valid" CHECK (
    "period_key" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ),
  CONSTRAINT "provider_budget_reservation_settlement_valid" CHECK (
    ("status" = 'SETTLED' AND "settled_at" IS NOT NULL) OR
    ("status" <> 'SETTLED')
  )
);

CREATE UNIQUE INDEX "provider_budget_reservations_idempotency_key_key"
  ON "provider_budget_reservations"("idempotency_key");
CREATE UNIQUE INDEX "provider_budget_reservations_usage_event_id_key"
  ON "provider_budget_reservations"("usage_event_id");
CREATE INDEX "provider_budget_reservations_period_key_status_category_idx"
  ON "provider_budget_reservations"("period_key", "status", "category");
CREATE INDEX "provider_budget_reservations_background_job_id_idx"
  ON "provider_budget_reservations"("background_job_id");
CREATE INDEX "provider_budget_reservations_ai_generation_id_idx"
  ON "provider_budget_reservations"("ai_generation_id");
CREATE INDEX "provider_budget_reservations_source_document_id_idx"
  ON "provider_budget_reservations"("source_document_id");

ALTER TABLE "provider_budget_reservations"
  ADD CONSTRAINT "provider_budget_reservations_usage_event_id_fkey"
  FOREIGN KEY ("usage_event_id") REFERENCES "provider_usage_events"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_budget_reservations"
  ADD CONSTRAINT "provider_budget_reservations_background_job_id_fkey"
  FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_budget_reservations"
  ADD CONSTRAINT "provider_budget_reservations_ai_generation_id_fkey"
  FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_budget_reservations"
  ADD CONSTRAINT "provider_budget_reservations_source_document_id_fkey"
  FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
