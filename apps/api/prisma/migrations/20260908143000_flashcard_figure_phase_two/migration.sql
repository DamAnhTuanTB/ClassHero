ALTER TYPE "BackgroundJobQueue" ADD VALUE 'FLASHCARD_FIGURE_RENDERING';

CREATE TYPE "FlashcardFigureRole" AS ENUM ('FRONT', 'BACK');
CREATE TYPE "FlashcardFigureStatus" AS ENUM ('QUEUED', 'RENDERING', 'SUCCEEDED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "FlashcardFigureRevisionStatus" AS ENUM ('QUEUED', 'RENDERING', 'SUCCEEDED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "FlashcardFigureSourceKind" AS ENUM ('AI_TEX', 'ADMIN_UPLOAD');
CREATE TYPE "FlashcardFigureRevisionOrigin" AS ENUM ('INITIAL_AI', 'ADMIN_REGENERATE', 'ADMIN_UPLOAD', 'MANUAL_REPAIR');
CREATE TYPE "FlashcardFigureAttemptKind" AS ENUM ('INITIAL', 'INFRA_RETRY', 'ADMIN_REGENERATE');
CREATE TYPE "FlashcardFigureAttemptStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "flashcard_figures" (
  "id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "flashcard_id" UUID NOT NULL,
  "role" "FlashcardFigureRole" NOT NULL,
  "ai_generation_id" UUID,
  "subject_key" VARCHAR(24) NOT NULL,
  "subject_name" VARCHAR(120) NOT NULL,
  "subject_slug" VARCHAR(140) NOT NULL,
  "status" "FlashcardFigureStatus" NOT NULL DEFAULT 'QUEUED',
  "last_error_category" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_by_id" UUID,
  "current_revision_id" UUID,
  "pending_revision_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "flashcard_figures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flashcard_figures_flashcard_id_role_key" ON "flashcard_figures"("flashcard_id", "role");
CREATE UNIQUE INDEX "flashcard_figures_current_revision_id_key" ON "flashcard_figures"("current_revision_id");
CREATE UNIQUE INDEX "flashcard_figures_pending_revision_id_key" ON "flashcard_figures"("pending_revision_id");
CREATE INDEX "flashcard_figures_lesson_id_status_idx" ON "flashcard_figures"("lesson_id", "status");
CREATE INDEX "flashcard_figures_flashcard_id_deleted_at_idx" ON "flashcard_figures"("flashcard_id", "deleted_at");
CREATE INDEX "flashcard_figures_ai_generation_id_idx" ON "flashcard_figures"("ai_generation_id");

CREATE TABLE "flashcard_figure_revisions" (
  "id" UUID NOT NULL,
  "flashcard_figure_id" UUID NOT NULL,
  "source_kind" "FlashcardFigureSourceKind" NOT NULL DEFAULT 'AI_TEX',
  "origin" "FlashcardFigureRevisionOrigin" NOT NULL,
  "status" "FlashcardFigureRevisionStatus" NOT NULL DEFAULT 'QUEUED',
  "latex_source" TEXT,
  "source_hash" TEXT,
  "source_version" INTEGER NOT NULL,
  "alt_text" TEXT NOT NULL,
  "caption" TEXT,
  "preview_svg" TEXT,
  "delivery_file_id" UUID,
  "sanitized_svg_hash" TEXT,
  "renderer_version" TEXT,
  "validator_version" TEXT,
  "last_error_category" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "flashcard_figure_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flashcard_figure_revisions_figure_version_key" ON "flashcard_figure_revisions"("flashcard_figure_id", "source_version");
CREATE INDEX "flashcard_figure_revisions_figure_created_idx" ON "flashcard_figure_revisions"("flashcard_figure_id", "created_at" DESC);
CREATE INDEX "flashcard_figure_revisions_status_created_idx" ON "flashcard_figure_revisions"("status", "created_at");
CREATE INDEX "flashcard_figure_revisions_delivery_file_idx" ON "flashcard_figure_revisions"("delivery_file_id");

CREATE TABLE "flashcard_figure_render_attempts" (
  "id" UUID NOT NULL,
  "flashcard_figure_id" UUID NOT NULL,
  "revision_id" UUID NOT NULL,
  "background_job_id" UUID,
  "attempt_number" INTEGER NOT NULL,
  "source_version" INTEGER NOT NULL,
  "kind" "FlashcardFigureAttemptKind" NOT NULL,
  "status" "FlashcardFigureAttemptStatus" NOT NULL DEFAULT 'RUNNING',
  "source_hash" TEXT NOT NULL,
  "compile_log" TEXT,
  "error_category" TEXT,
  "error_code" TEXT,
  "duration_ms" INTEGER,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flashcard_figure_render_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flashcard_figure_render_attempts_figure_attempt_key" ON "flashcard_figure_render_attempts"("flashcard_figure_id", "attempt_number");
CREATE INDEX "flashcard_figure_render_attempts_job_idx" ON "flashcard_figure_render_attempts"("background_job_id");
CREATE INDEX "flashcard_figure_render_attempts_revision_created_idx" ON "flashcard_figure_render_attempts"("revision_id", "created_at");
CREATE INDEX "flashcard_figure_render_attempts_figure_status_idx" ON "flashcard_figure_render_attempts"("flashcard_figure_id", "status");

ALTER TABLE "flashcard_figures" ADD CONSTRAINT "flashcard_figures_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flashcard_figures" ADD CONSTRAINT "flashcard_figures_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flashcard_figures" ADD CONSTRAINT "flashcard_figures_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flashcard_figures" ADD CONSTRAINT "flashcard_figures_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "flashcard_figure_revisions" ADD CONSTRAINT "flashcard_figure_revisions_figure_id_fkey" FOREIGN KEY ("flashcard_figure_id") REFERENCES "flashcard_figures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flashcard_figure_revisions" ADD CONSTRAINT "flashcard_figure_revisions_delivery_file_id_fkey" FOREIGN KEY ("delivery_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flashcard_figure_revisions" ADD CONSTRAINT "flashcard_figure_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "flashcard_figures" ADD CONSTRAINT "flashcard_figures_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "flashcard_figure_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flashcard_figures" ADD CONSTRAINT "flashcard_figures_pending_revision_id_fkey" FOREIGN KEY ("pending_revision_id") REFERENCES "flashcard_figure_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "flashcard_figure_render_attempts" ADD CONSTRAINT "flashcard_figure_render_attempts_figure_id_fkey" FOREIGN KEY ("flashcard_figure_id") REFERENCES "flashcard_figures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flashcard_figure_render_attempts" ADD CONSTRAINT "flashcard_figure_render_attempts_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "flashcard_figure_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flashcard_figure_render_attempts" ADD CONSTRAINT "flashcard_figure_render_attempts_job_id_fkey" FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
