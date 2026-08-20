CREATE TYPE "SearchablePdfValidationStatus" AS ENUM (
  'PENDING',
  'PASSED',
  'WARNING',
  'FAILED',
  'EXPIRED',
  'PROMOTED'
);

ALTER TABLE "source_documents"
  ADD COLUMN "active_ocr_artifact_id" UUID;

ALTER TABLE "lesson_documents"
  ADD COLUMN "active_ocr_artifact_id" UUID;

CREATE TABLE "document_ocr_artifacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_document_id" UUID,
  "lesson_document_id" UUID,
  "provider" VARCHAR(40) NOT NULL,
  "provider_document_id" TEXT,
  "source_content_hash" TEXT NOT NULL,
  "model_version" TEXT NOT NULL,
  "options_hash" TEXT NOT NULL,
  "page_count" INTEGER NOT NULL,
  "artifact_base_key" TEXT NOT NULL,
  "manifest_object_key" TEXT NOT NULL,
  "pages_object_key" TEXT NOT NULL,
  "image_manifest_object_key" TEXT NOT NULL,
  "artifact_audit_object_key" TEXT,
  "status" "DocumentStatus" NOT NULL DEFAULT 'READY',
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_ocr_artifacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_ocr_artifacts_exactly_one_owner_check"
    CHECK (num_nonnulls("source_document_id", "lesson_document_id") = 1)
);

CREATE UNIQUE INDEX "document_ocr_artifacts_source_document_id_provider_options_hash_source_content_hash_key"
  ON "document_ocr_artifacts"("source_document_id", "provider", "options_hash", "source_content_hash");
CREATE UNIQUE INDEX "document_ocr_artifacts_lesson_document_id_provider_options_hash_source_content_hash_key"
  ON "document_ocr_artifacts"("lesson_document_id", "provider", "options_hash", "source_content_hash");
CREATE INDEX "document_ocr_artifacts_source_document_id_status_idx"
  ON "document_ocr_artifacts"("source_document_id", "status");
CREATE INDEX "document_ocr_artifacts_lesson_document_id_status_idx"
  ON "document_ocr_artifacts"("lesson_document_id", "status");
CREATE INDEX "document_ocr_artifacts_source_content_hash_idx"
  ON "document_ocr_artifacts"("source_content_hash");

ALTER TABLE "document_ocr_artifacts"
  ADD CONSTRAINT "document_ocr_artifacts_source_document_id_fkey"
  FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_ocr_artifacts"
  ADD CONSTRAINT "document_ocr_artifacts_lesson_document_id_fkey"
  FOREIGN KEY ("lesson_document_id") REFERENCES "lesson_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "document_ocr_artifacts" (
  "source_document_id", "provider", "provider_document_id", "source_content_hash",
  "model_version", "options_hash", "page_count", "artifact_base_key",
  "manifest_object_key", "pages_object_key", "image_manifest_object_key",
  "artifact_audit_object_key", "status", "metadata_json", "created_at", "updated_at"
)
SELECT
  sd."id",
  COALESCE(sd."metadata_json"->'ocr'->>'provider', 'mathpix'),
  sd."metadata_json"->'ocr'->>'pdfId',
  COALESCE(sd."metadata_json"->'ocr'->>'contentHash', sd."content_hash"),
  COALESCE(sd."metadata_json"->'ocr'->>'modelVersion', 'unknown'),
  COALESCE(sd."metadata_json"->'ocr'->>'optionsHash', 'legacy'),
  COALESCE((sd."metadata_json"->'ocr'->>'pageCount')::INTEGER, sd."page_count", 0),
  sd."metadata_json"->'ocr'->>'artifactBaseKey',
  COALESCE(sd."metadata_json"->'ocr'->>'manifestKey', sd."metadata_json"->'ocr'->'artifactKeys'->>'manifestJson'),
  COALESCE(sd."metadata_json"->'ocr'->>'normalizedPagesKey', sd."metadata_json"->'ocr'->'artifactKeys'->>'pagesJson'),
  COALESCE(sd."metadata_json"->'ocr'->>'imageManifestKey', sd."metadata_json"->'visualAssets'->>'imageManifestKey'),
  COALESCE(sd."metadata_json"->'ocr'->>'artifactAuditKey', sd."metadata_json"->'visualAssets'->>'artifactAuditKey'),
  'READY'::"DocumentStatus",
  jsonb_build_object('backfilledFrom', 'source_documents.metadata_json.ocr'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "source_documents" sd
WHERE sd."metadata_json"->'ocr' IS NOT NULL
  AND COALESCE(sd."metadata_json"->'ocr'->>'contentHash', sd."content_hash") IS NOT NULL
  AND sd."metadata_json"->'ocr'->>'artifactBaseKey' IS NOT NULL
  AND COALESCE(sd."metadata_json"->'ocr'->>'manifestKey', sd."metadata_json"->'ocr'->'artifactKeys'->>'manifestJson') IS NOT NULL
  AND COALESCE(sd."metadata_json"->'ocr'->>'normalizedPagesKey', sd."metadata_json"->'ocr'->'artifactKeys'->>'pagesJson') IS NOT NULL
  AND COALESCE(sd."metadata_json"->'ocr'->>'imageManifestKey', sd."metadata_json"->'visualAssets'->>'imageManifestKey') IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "document_ocr_artifacts" (
  "lesson_document_id", "provider", "provider_document_id", "source_content_hash",
  "model_version", "options_hash", "page_count", "artifact_base_key",
  "manifest_object_key", "pages_object_key", "image_manifest_object_key",
  "artifact_audit_object_key", "status", "metadata_json", "created_at", "updated_at"
)
SELECT
  ld."id",
  COALESCE(ld."metadata_json"->'ocr'->>'provider', 'mathpix'),
  ld."metadata_json"->'ocr'->>'pdfId',
  COALESCE(ld."metadata_json"->'ocr'->>'contentHash', ld."content_hash"),
  COALESCE(ld."metadata_json"->'ocr'->>'modelVersion', 'unknown'),
  COALESCE(ld."metadata_json"->'ocr'->>'optionsHash', 'legacy'),
  COALESCE((ld."metadata_json"->'ocr'->>'pageCount')::INTEGER, 0),
  ld."metadata_json"->'ocr'->>'artifactBaseKey',
  COALESCE(ld."metadata_json"->'ocr'->>'manifestKey', ld."metadata_json"->'ocr'->'artifactKeys'->>'manifestJson'),
  COALESCE(ld."metadata_json"->'ocr'->>'normalizedPagesKey', ld."metadata_json"->'ocr'->'artifactKeys'->>'pagesJson'),
  COALESCE(ld."metadata_json"->'ocr'->>'imageManifestKey', ld."metadata_json"->'visualAssets'->>'imageManifestKey'),
  COALESCE(ld."metadata_json"->'ocr'->>'artifactAuditKey', ld."metadata_json"->'visualAssets'->>'artifactAuditKey'),
  'READY'::"DocumentStatus",
  jsonb_build_object('backfilledFrom', 'lesson_documents.metadata_json.ocr'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "lesson_documents" ld
WHERE ld."metadata_json"->'ocr' IS NOT NULL
  AND COALESCE(ld."metadata_json"->'ocr'->>'contentHash', ld."content_hash") IS NOT NULL
  AND ld."metadata_json"->'ocr'->>'artifactBaseKey' IS NOT NULL
  AND COALESCE(ld."metadata_json"->'ocr'->>'manifestKey', ld."metadata_json"->'ocr'->'artifactKeys'->>'manifestJson') IS NOT NULL
  AND COALESCE(ld."metadata_json"->'ocr'->>'normalizedPagesKey', ld."metadata_json"->'ocr'->'artifactKeys'->>'pagesJson') IS NOT NULL
  AND COALESCE(ld."metadata_json"->'ocr'->>'imageManifestKey', ld."metadata_json"->'visualAssets'->>'imageManifestKey') IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "source_documents" sd
SET "active_ocr_artifact_id" = (
  SELECT doa."id"
  FROM "document_ocr_artifacts" doa
  WHERE doa."source_document_id" = sd."id" AND doa."status" = 'READY'
  ORDER BY doa."created_at" DESC, doa."id" DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "document_ocr_artifacts" doa
  WHERE doa."source_document_id" = sd."id" AND doa."status" = 'READY'
);

UPDATE "lesson_documents" ld
SET "active_ocr_artifact_id" = (
  SELECT doa."id"
  FROM "document_ocr_artifacts" doa
  WHERE doa."lesson_document_id" = ld."id" AND doa."status" = 'READY'
  ORDER BY doa."created_at" DESC, doa."id" DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "document_ocr_artifacts" doa
  WHERE doa."lesson_document_id" = ld."id" AND doa."status" = 'READY'
);

CREATE UNIQUE INDEX "source_documents_active_ocr_artifact_id_key"
  ON "source_documents"("active_ocr_artifact_id");
CREATE INDEX "lesson_documents_active_ocr_artifact_id_idx"
  ON "lesson_documents"("active_ocr_artifact_id");
ALTER TABLE "source_documents"
  ADD CONSTRAINT "source_documents_active_ocr_artifact_id_fkey"
  FOREIGN KEY ("active_ocr_artifact_id") REFERENCES "document_ocr_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lesson_documents"
  ADD CONSTRAINT "lesson_documents_active_ocr_artifact_id_fkey"
  FOREIGN KEY ("active_ocr_artifact_id") REFERENCES "document_ocr_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "searchable_pdf_validations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_document_id" UUID NOT NULL,
  "original_file_id" UUID NOT NULL,
  "candidate_file_id" UUID NOT NULL,
  "original_checksum" TEXT NOT NULL,
  "candidate_checksum" TEXT NOT NULL,
  "status" "SearchablePdfValidationStatus" NOT NULL DEFAULT 'PENDING',
  "report_json" JSONB,
  "contact_sheet_object_key" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "promoted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "searchable_pdf_validations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "searchable_pdf_validations_source_document_id_created_at_idx"
  ON "searchable_pdf_validations"("source_document_id", "created_at" DESC);
CREATE INDEX "searchable_pdf_validations_status_expires_at_idx"
  ON "searchable_pdf_validations"("status", "expires_at");
ALTER TABLE "searchable_pdf_validations"
  ADD CONSTRAINT "searchable_pdf_validations_source_document_id_fkey"
  FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "searchable_pdf_validations"
  ADD CONSTRAINT "searchable_pdf_validations_original_file_id_fkey"
  FOREIGN KEY ("original_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "searchable_pdf_validations"
  ADD CONSTRAINT "searchable_pdf_validations_candidate_file_id_fkey"
  FOREIGN KEY ("candidate_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "lesson_summary_request_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lesson_id" UUID NOT NULL,
  "created_by_id" UUID,
  "request_hash" TEXT NOT NULL,
  "packet_hash" TEXT NOT NULL,
  "manifest_hash" TEXT NOT NULL,
  "packet_object_key" TEXT NOT NULL,
  "packet_filename" TEXT NOT NULL,
  "packet_size_bytes" BIGINT NOT NULL,
  "packet_page_count" INTEGER NOT NULL,
  "system_instructions" TEXT NOT NULL,
  "user_prompt" TEXT NOT NULL,
  "schema_name" TEXT NOT NULL,
  "schema_version" TEXT NOT NULL,
  "schema_hash" TEXT NOT NULL,
  "schema_json" JSONB NOT NULL,
  "manifest_json" JSONB NOT NULL,
  "source_snapshot_json" JSONB NOT NULL,
  "model_config_json" JSONB NOT NULL,
  "cost_estimate_json" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_summary_request_drafts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lesson_summary_request_drafts_request_hash_key"
  ON "lesson_summary_request_drafts"("request_hash");
CREATE INDEX "lesson_summary_request_drafts_lesson_id_created_at_idx"
  ON "lesson_summary_request_drafts"("lesson_id", "created_at" DESC);
CREATE INDEX "lesson_summary_request_drafts_expires_at_idx"
  ON "lesson_summary_request_drafts"("expires_at");
ALTER TABLE "lesson_summary_request_drafts"
  ADD CONSTRAINT "lesson_summary_request_drafts_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stem_figures"
  ADD COLUMN "figure_index" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "local_plan_id" TEXT NOT NULL DEFAULT 'F01',
  ADD COLUMN "plan_json" JSONB;

ALTER TABLE "stem_figure_revisions"
  ADD COLUMN "reference_snapshot_json" JSONB,
  ADD COLUMN "reference_snapshot_hash" TEXT,
  ADD COLUMN "generation_brief_hash" TEXT;

CREATE UNIQUE INDEX "stem_figures_lesson_summary_id_block_path_figure_index_key"
  ON "stem_figures"("lesson_summary_id", "block_path", "figure_index");

-- Summary PDF packet requests require native PDF vision at detail=high. Preserve
-- the existing feature list while making this capability explicit for routing/UI.
UPDATE "provider_catalog_items"
SET "capabilities_json" = jsonb_build_object(
      'features', COALESCE(
        CASE
          WHEN jsonb_typeof("capabilities_json"::jsonb) = 'array'
            THEN "capabilities_json"::jsonb
          ELSE "capabilities_json"::jsonb -> 'features'
        END,
        '[]'::jsonb
      ),
      'pdfInput', true,
      'pdfDetailLevels', jsonb_build_array('auto', 'low', 'high'),
      'aiConfiguration', COALESCE("capabilities_json"::jsonb -> 'aiConfiguration', 'null'::jsonb),
      'reasoningEffortLevels', COALESCE("capabilities_json"::jsonb -> 'reasoningEffortLevels', '[]'::jsonb)
    ),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "category" = 'AI_MODEL'
  AND "provider" = 'OPENAI'
  AND "external_key" IN (
    'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna',
    'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano',
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'
  );
