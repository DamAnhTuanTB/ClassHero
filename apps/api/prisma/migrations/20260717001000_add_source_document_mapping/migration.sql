-- M4.2 source document, page range mapping, and lesson document kind.

CREATE TYPE "LessonDocumentKind" AS ENUM (
    'PRIMARY_FROM_SOURCE',
    'PRIMARY_REPLACEMENT',
    'SUPPLEMENT'
);

ALTER TABLE "lesson_documents"
ADD COLUMN "source_document_id" UUID,
ADD COLUMN "kind" "LessonDocumentKind" NOT NULL DEFAULT 'SUPPLEMENT',
ADD COLUMN "replaced_at" TIMESTAMP(3);

CREATE TABLE "source_documents" (
    "id" UUID NOT NULL,
    "learning_path_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "title" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "page_count" INTEGER,
    "content_hash" TEXT,
    "processing_job_id" UUID,
    "processed_at" TIMESTAMP(3),
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_document_pages" (
    "id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "text" TEXT,
    "text_source" TEXT,
    "quality_score" DOUBLE PRECISION,
    "thumbnail_file_id" UUID,
    "extract_error" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_document_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lesson_document_page_ranges" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "page_start" INTEGER NOT NULL,
    "page_end" INTEGER NOT NULL,
    "created_by_id" UUID,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_document_page_ranges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lesson_document_page_ranges_page_order_check" CHECK ("page_start" <= "page_end")
);

CREATE UNIQUE INDEX "source_document_pages_source_document_id_page_number_key"
ON "source_document_pages"("source_document_id", "page_number");

CREATE UNIQUE INDEX "lesson_document_page_ranges_lesson_id_source_document_id_key"
ON "lesson_document_page_ranges"("lesson_id", "source_document_id");

CREATE UNIQUE INDEX "lesson_documents_one_active_primary_per_lesson_idx"
ON "lesson_documents"("lesson_id")
WHERE "kind" IN ('PRIMARY_FROM_SOURCE', 'PRIMARY_REPLACEMENT')
  AND "replaced_at" IS NULL;

CREATE INDEX "source_documents_learning_path_id_idx"
ON "source_documents"("learning_path_id");

CREATE INDEX "source_documents_status_idx"
ON "source_documents"("status");

CREATE INDEX "source_documents_content_hash_idx"
ON "source_documents"("content_hash");

CREATE INDEX "source_documents_file_id_idx"
ON "source_documents"("file_id");

CREATE INDEX "source_documents_processing_job_id_idx"
ON "source_documents"("processing_job_id");

CREATE INDEX "source_documents_deleted_at_idx"
ON "source_documents"("deleted_at");

CREATE INDEX "source_document_pages_source_document_id_status_idx"
ON "source_document_pages"("source_document_id", "status");

CREATE INDEX "source_document_pages_thumbnail_file_id_idx"
ON "source_document_pages"("thumbnail_file_id");

CREATE INDEX "lesson_document_page_ranges_lesson_id_idx"
ON "lesson_document_page_ranges"("lesson_id");

CREATE INDEX "lesson_document_page_ranges_source_document_id_idx"
ON "lesson_document_page_ranges"("source_document_id");

CREATE INDEX "lesson_document_page_ranges_created_by_id_idx"
ON "lesson_document_page_ranges"("created_by_id");

CREATE INDEX "lesson_documents_lesson_id_kind_idx"
ON "lesson_documents"("lesson_id", "kind");

CREATE INDEX "lesson_documents_source_document_id_idx"
ON "lesson_documents"("source_document_id");

CREATE INDEX "lesson_documents_replaced_at_idx"
ON "lesson_documents"("replaced_at");

ALTER TABLE "source_documents"
ADD CONSTRAINT "source_documents_learning_path_id_fkey"
FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "source_documents"
ADD CONSTRAINT "source_documents_file_id_fkey"
FOREIGN KEY ("file_id") REFERENCES "files"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "source_documents"
ADD CONSTRAINT "source_documents_processing_job_id_fkey"
FOREIGN KEY ("processing_job_id") REFERENCES "background_jobs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "source_document_pages"
ADD CONSTRAINT "source_document_pages_source_document_id_fkey"
FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "source_document_pages"
ADD CONSTRAINT "source_document_pages_thumbnail_file_id_fkey"
FOREIGN KEY ("thumbnail_file_id") REFERENCES "files"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lesson_document_page_ranges"
ADD CONSTRAINT "lesson_document_page_ranges_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_document_page_ranges"
ADD CONSTRAINT "lesson_document_page_ranges_source_document_id_fkey"
FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_document_page_ranges"
ADD CONSTRAINT "lesson_document_page_ranges_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lesson_documents"
ADD CONSTRAINT "lesson_documents_source_document_id_fkey"
FOREIGN KEY ("source_document_id") REFERENCES "source_documents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
