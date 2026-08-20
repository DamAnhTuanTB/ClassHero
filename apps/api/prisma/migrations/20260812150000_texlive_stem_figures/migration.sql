CREATE TYPE "StemFigureStatus" AS ENUM (
  'QUEUED',
  'RENDERING',
  'REPAIRING',
  'SUCCEEDED',
  'NEEDS_REVIEW',
  'FAILED'
);

CREATE TYPE "StemFigureTheme" AS ENUM ('LIGHT');

CREATE TYPE "StemFigureAttemptKind" AS ENUM (
  'INITIAL',
  'AI_REPAIR',
  'INFRA_RETRY',
  'ADMIN_EDIT',
  'ADMIN_REGENERATE',
  'ADMIN_UPLOAD',
  'MANUAL_COMPILER_REPAIR',
  'MANUAL_VALIDATOR_REPAIR',
  'COMPILE_PREVIEW'
);

CREATE TYPE "StemFigureAttemptStatus" AS ENUM (
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TYPE "StemFigureRevisionStatus" AS ENUM (
  'QUEUED',
  'RENDERING',
  'REPAIRING',
  'DRAFT_READY',
  'SUCCEEDED',
  'NEEDS_REVIEW',
  'FAILED'
);

CREATE TYPE "StemFigureSourceKind" AS ENUM ('AI_TEX', 'ADMIN_UPLOAD');

CREATE TYPE "StemFigureRevisionOrigin" AS ENUM (
  'INITIAL_AI',
  'AUTO_REPAIR',
  'ADMIN_EDIT',
  'ADMIN_REGENERATE',
  'ADMIN_UPLOAD',
  'MANUAL_REPAIR'
);

CREATE TABLE "stem_figures" (
  "id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "lesson_summary_id" UUID,
  "ai_generation_id" UUID,
  "block_path" TEXT NOT NULL,
  "subject_key" VARCHAR(24) NOT NULL,
  "subject_name" VARCHAR(120) NOT NULL,
  "subject_slug" VARCHAR(140) NOT NULL,
  "status" "StemFigureStatus" NOT NULL DEFAULT 'QUEUED',
  "theme" "StemFigureTheme" NOT NULL DEFAULT 'LIGHT',
  "last_error_category" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_by_id" UUID,
  "current_revision_id" UUID,
  "pending_revision_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "stem_figures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stem_figure_revisions" (
  "id" UUID NOT NULL,
  "stem_figure_id" UUID NOT NULL,
  "source_kind" "StemFigureSourceKind" NOT NULL DEFAULT 'AI_TEX',
  "origin" "StemFigureRevisionOrigin" NOT NULL,
  "status" "StemFigureRevisionStatus" NOT NULL DEFAULT 'QUEUED',
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
  "repair_count" INTEGER NOT NULL DEFAULT 0,
  "max_repair_attempts" INTEGER NOT NULL DEFAULT 2,
  "last_error_category" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "stem_figure_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stem_figure_render_attempts" (
  "id" UUID NOT NULL,
  "stem_figure_id" UUID NOT NULL,
  "revision_id" UUID NOT NULL,
  "background_job_id" UUID,
  "attempt_number" INTEGER NOT NULL,
  "source_version" INTEGER NOT NULL,
  "kind" "StemFigureAttemptKind" NOT NULL,
  "status" "StemFigureAttemptStatus" NOT NULL DEFAULT 'RUNNING',
  "source_hash" TEXT NOT NULL,
  "compile_log" TEXT,
  "error_category" TEXT,
  "error_code" TEXT,
  "validator_issues_json" JSONB,
  "diagnostic_batch_json" JSONB,
  "diagnostic_batch_hash" TEXT,
  "collection_complete" BOOLEAN NOT NULL DEFAULT true,
  "duration_ms" INTEGER,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stem_figure_render_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stem_figures_current_revision_id_key"
  ON "stem_figures"("current_revision_id");
CREATE UNIQUE INDEX "stem_figures_pending_revision_id_key"
  ON "stem_figures"("pending_revision_id");
CREATE INDEX "stem_figures_lesson_id_status_idx"
  ON "stem_figures"("lesson_id", "status");
CREATE INDEX "stem_figures_lesson_id_deleted_at_status_idx"
  ON "stem_figures"("lesson_id", "deleted_at", "status");
CREATE INDEX "stem_figures_lesson_summary_id_block_path_idx"
  ON "stem_figures"("lesson_summary_id", "block_path");
CREATE INDEX "stem_figures_ai_generation_id_idx"
  ON "stem_figures"("ai_generation_id");
CREATE INDEX "stem_figures_subject_key_idx"
  ON "stem_figures"("subject_key");

CREATE UNIQUE INDEX "stem_figure_revisions_stem_figure_id_source_version_key"
  ON "stem_figure_revisions"("stem_figure_id", "source_version");
CREATE INDEX "stem_figure_revisions_stem_figure_id_created_at_idx"
  ON "stem_figure_revisions"("stem_figure_id", "created_at" DESC);
CREATE INDEX "stem_figure_revisions_status_created_at_idx"
  ON "stem_figure_revisions"("status", "created_at");
CREATE INDEX "stem_figure_revisions_delivery_file_id_idx"
  ON "stem_figure_revisions"("delivery_file_id");

CREATE UNIQUE INDEX "stem_figure_render_attempts_stem_figure_id_attempt_number_key"
  ON "stem_figure_render_attempts"("stem_figure_id", "attempt_number");
CREATE INDEX "stem_figure_render_attempts_background_job_id_idx"
  ON "stem_figure_render_attempts"("background_job_id");
CREATE INDEX "stem_figure_render_attempts_revision_id_created_at_idx"
  ON "stem_figure_render_attempts"("revision_id", "created_at");
CREATE INDEX "stem_figure_render_attempts_stem_figure_id_status_idx"
  ON "stem_figure_render_attempts"("stem_figure_id", "status");

ALTER TABLE "stem_figures"
  ADD CONSTRAINT "stem_figures_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figures_lesson_summary_id_fkey"
  FOREIGN KEY ("lesson_summary_id") REFERENCES "lesson_summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figures_ai_generation_id_fkey"
  FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figures_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stem_figure_revisions"
  ADD CONSTRAINT "stem_figure_revisions_stem_figure_id_fkey"
  FOREIGN KEY ("stem_figure_id") REFERENCES "stem_figures"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figure_revisions_delivery_file_id_fkey"
  FOREIGN KEY ("delivery_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figure_revisions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stem_figures"
  ADD CONSTRAINT "stem_figures_current_revision_id_fkey"
  FOREIGN KEY ("current_revision_id") REFERENCES "stem_figure_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figures_pending_revision_id_fkey"
  FOREIGN KEY ("pending_revision_id") REFERENCES "stem_figure_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stem_figure_render_attempts"
  ADD CONSTRAINT "stem_figure_render_attempts_stem_figure_id_fkey"
  FOREIGN KEY ("stem_figure_id") REFERENCES "stem_figures"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figure_render_attempts_revision_id_fkey"
  FOREIGN KEY ("revision_id") REFERENCES "stem_figure_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "stem_figure_render_attempts_background_job_id_fkey"
  FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_explanations" DROP COLUMN "diagram_spec_json";
