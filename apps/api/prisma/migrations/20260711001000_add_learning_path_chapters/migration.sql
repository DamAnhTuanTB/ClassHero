-- M3.4 chapter grouping for admin learning path management.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE "FileProvider" ADD VALUE IF NOT EXISTS 'MINIO_LOCAL';

ALTER TABLE "learning_paths"
ADD COLUMN "total_chapter_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "learning_path_chapters" (
    "id" UUID NOT NULL,
    "learning_path_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "objectives_json" JSONB,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "learning_path_chapters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_path_chapters_learning_path_id_order_index_key"
ON "learning_path_chapters"("learning_path_id", "order_index");

CREATE INDEX "learning_path_chapters_learning_path_id_status_idx"
ON "learning_path_chapters"("learning_path_id", "status");

CREATE INDEX "learning_path_chapters_created_by_id_idx"
ON "learning_path_chapters"("created_by_id");

CREATE INDEX "learning_path_chapters_updated_by_id_idx"
ON "learning_path_chapters"("updated_by_id");

ALTER TABLE "learning_path_chapters"
ADD CONSTRAINT "learning_path_chapters_learning_path_id_fkey"
FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_path_chapters"
ADD CONSTRAINT "learning_path_chapters_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "learning_path_chapters"
ADD CONSTRAINT "learning_path_chapters_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lessons"
ADD COLUMN "chapter_id" UUID;

INSERT INTO "learning_path_chapters" (
    "id",
    "learning_path_id",
    "order_index",
    "title",
    "overview",
    "status",
    "created_by_id",
    "updated_by_id",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    "learning_paths"."id",
    1,
    'Chương 1: Nội dung chính',
    'Chương mặc định được tạo khi nâng cấp dữ liệu buổi học hiện có.',
    "learning_paths"."status",
    "learning_paths"."created_by_id",
    "learning_paths"."updated_by_id",
    "learning_paths"."created_at",
    CURRENT_TIMESTAMP
FROM "learning_paths"
WHERE EXISTS (
    SELECT 1
    FROM "lessons"
    WHERE "lessons"."learning_path_id" = "learning_paths"."id"
);

UPDATE "lessons"
SET "chapter_id" = "learning_path_chapters"."id"
FROM "learning_path_chapters"
WHERE "lessons"."learning_path_id" = "learning_path_chapters"."learning_path_id"
  AND "learning_path_chapters"."order_index" = 1;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "lessons" WHERE "chapter_id" IS NULL) THEN
        RAISE EXCEPTION 'Unable to backfill chapter_id for all lessons';
    END IF;
END $$;

ALTER TABLE "lessons"
ALTER COLUMN "chapter_id" SET NOT NULL;

DROP INDEX IF EXISTS "lessons_learning_path_id_order_index_key";

CREATE INDEX "lessons_chapter_id_status_idx"
ON "lessons"("chapter_id", "status");

CREATE UNIQUE INDEX "lessons_chapter_id_order_index_key"
ON "lessons"("chapter_id", "order_index");

ALTER TABLE "lessons"
ADD CONSTRAINT "lessons_chapter_id_fkey"
FOREIGN KEY ("chapter_id") REFERENCES "learning_path_chapters"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "learning_paths"
SET "total_chapter_count" = "chapter_counts"."count"
FROM (
    SELECT "learning_path_id", COUNT(*)::INTEGER AS "count"
    FROM "learning_path_chapters"
    WHERE "deleted_at" IS NULL
    GROUP BY "learning_path_id"
) AS "chapter_counts"
WHERE "learning_paths"."id" = "chapter_counts"."learning_path_id";
