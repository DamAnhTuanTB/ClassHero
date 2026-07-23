-- Add the personal learning-path classification and clone queue.
CREATE TYPE "LearningPathKind" AS ENUM ('CATALOG', 'PERSONALIZED');

ALTER TYPE "BackgroundJobQueue" ADD VALUE 'PERSONAL_LEARNING_PATH_CLONE';

ALTER TABLE "background_jobs"
ADD COLUMN "idempotency_key" TEXT;

ALTER TABLE "learning_paths"
ADD COLUMN "kind" "LearningPathKind" NOT NULL DEFAULT 'CATALOG',
ADD COLUMN "source_learning_path_id" UUID;

ALTER TABLE "learning_path_chapters"
ADD COLUMN "source_chapter_id" UUID;

ALTER TABLE "lessons"
ADD COLUMN "source_lesson_id" UUID;

ALTER TABLE "enrollments"
ADD COLUMN "delivery_learning_path_id" UUID;

CREATE UNIQUE INDEX "background_jobs_idempotency_key_key"
ON "background_jobs"("idempotency_key");

CREATE UNIQUE INDEX "background_jobs_one_active_personal_clone_per_enrollment"
ON "background_jobs"("resource_id")
WHERE "queue" = 'PERSONAL_LEARNING_PATH_CLONE'
  AND "resource_type" = 'ENROLLMENT'
  AND "status" IN ('QUEUED', 'RUNNING');

CREATE INDEX "learning_paths_kind_status_idx"
ON "learning_paths"("kind", "status");

CREATE INDEX "learning_paths_source_learning_path_id_idx"
ON "learning_paths"("source_learning_path_id");

CREATE INDEX "learning_path_chapters_source_chapter_id_idx"
ON "learning_path_chapters"("source_chapter_id");

CREATE INDEX "lessons_source_lesson_id_idx"
ON "lessons"("source_lesson_id");

CREATE UNIQUE INDEX "enrollments_delivery_learning_path_id_key"
ON "enrollments"("delivery_learning_path_id");

CREATE INDEX "enrollments_delivery_learning_path_id_idx"
ON "enrollments"("delivery_learning_path_id");

ALTER TABLE "learning_paths"
ADD CONSTRAINT "learning_paths_source_learning_path_id_fkey"
FOREIGN KEY ("source_learning_path_id")
REFERENCES "learning_paths"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "learning_path_chapters"
ADD CONSTRAINT "learning_path_chapters_source_chapter_id_fkey"
FOREIGN KEY ("source_chapter_id")
REFERENCES "learning_path_chapters"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "lessons"
ADD CONSTRAINT "lessons_source_lesson_id_fkey"
FOREIGN KEY ("source_lesson_id")
REFERENCES "lessons"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "enrollments"
ADD CONSTRAINT "enrollments_delivery_learning_path_id_fkey"
FOREIGN KEY ("delivery_learning_path_id")
REFERENCES "learning_paths"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
