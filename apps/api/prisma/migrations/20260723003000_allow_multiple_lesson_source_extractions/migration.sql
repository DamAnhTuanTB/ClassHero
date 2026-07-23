-- Multiple extraction blocks may use the same lesson/source pair.
DROP INDEX IF EXISTS "lesson_document_page_ranges_lesson_id_source_document_id_key";

ALTER TABLE "lesson_documents"
ADD COLUMN "page_range_id" UUID,
ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

UPDATE "lesson_documents" AS lesson_document
SET "page_range_id" = (
  SELECT page_range."id"
  FROM "lesson_document_page_ranges" AS page_range
  WHERE page_range."lesson_id" = lesson_document."lesson_id"
    AND page_range."source_document_id" = lesson_document."source_document_id"
  ORDER BY page_range."updated_at" DESC, page_range."id" DESC
  LIMIT 1
)
WHERE lesson_document."source_document_id" IS NOT NULL
  AND lesson_document."replaced_at" IS NULL
  AND lesson_document."metadata_json"->>'source' = 'source_document_page_range';

CREATE UNIQUE INDEX "lesson_documents_page_range_id_key"
ON "lesson_documents"("page_range_id");

CREATE INDEX "lesson_documents_page_range_id_idx"
ON "lesson_documents"("page_range_id");

CREATE INDEX "lesson_documents_lesson_id_kind_sort_order_idx"
ON "lesson_documents"("lesson_id", "kind", "sort_order");

CREATE INDEX "lesson_document_page_ranges_lesson_id_source_document_id_idx"
ON "lesson_document_page_ranges"("lesson_id", "source_document_id");

ALTER TABLE "lesson_documents"
ADD CONSTRAINT "lesson_documents_page_range_id_fkey"
FOREIGN KEY ("page_range_id")
REFERENCES "lesson_document_page_ranges"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
