-- Keep document role and replacement history as separate concepts.
-- All legacy primary replacement rows become canonical foundation documents.

DROP INDEX IF EXISTS "lesson_documents_one_active_primary_per_lesson_idx";

UPDATE "lesson_documents"
SET "kind" = 'PRIMARY_FROM_SOURCE'
WHERE "kind"::text = 'PRIMARY_REPLACEMENT';

ALTER TABLE "lesson_documents"
ALTER COLUMN "kind" DROP DEFAULT;

ALTER TYPE "LessonDocumentKind"
RENAME TO "LessonDocumentKind_old";

CREATE TYPE "LessonDocumentKind" AS ENUM (
    'PRIMARY_FROM_SOURCE',
    'SUPPLEMENT',
    'HOMEWORK'
);

ALTER TABLE "lesson_documents"
ALTER COLUMN "kind" TYPE "LessonDocumentKind"
USING ("kind"::text::"LessonDocumentKind");

ALTER TABLE "lesson_documents"
ALTER COLUMN "kind" SET DEFAULT 'SUPPLEMENT';

DROP TYPE "LessonDocumentKind_old";

CREATE UNIQUE INDEX "lesson_documents_one_active_primary_per_lesson_idx"
ON "lesson_documents"("lesson_id")
WHERE "kind" = 'PRIMARY_FROM_SOURCE'
  AND "replaced_at" IS NULL;
