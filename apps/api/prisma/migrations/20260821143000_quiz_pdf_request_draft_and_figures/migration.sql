ALTER TYPE "BackgroundJobQueue" ADD VALUE 'QUIZ_FIGURE_RENDERING';

CREATE TYPE "QuizSolutionFigureMode" AS ENUM ('NONE', 'REUSE_QUESTION', 'EXTEND_QUESTION');
CREATE TYPE "QuizFigureRole" AS ENUM ('QUESTION', 'SOLUTION');
CREATE TYPE "QuizFigureStatus" AS ENUM ('QUEUED', 'RENDERING', 'REPAIRING', 'SUCCEEDED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "QuizFigureRevisionStatus" AS ENUM ('QUEUED', 'RENDERING', 'REPAIRING', 'DRAFT_READY', 'SUCCEEDED', 'NEEDS_REVIEW', 'FAILED');
CREATE TYPE "QuizFigureSourceKind" AS ENUM ('AI_TEX', 'ADMIN_UPLOAD');
CREATE TYPE "QuizFigureRevisionOrigin" AS ENUM ('INITIAL_AI', 'AUTO_REPAIR', 'ADMIN_EDIT', 'ADMIN_REGENERATE', 'ADMIN_UPLOAD', 'MANUAL_REPAIR');
CREATE TYPE "QuizFigureAttemptKind" AS ENUM ('INITIAL', 'AI_REPAIR', 'INFRA_RETRY', 'ADMIN_EDIT', 'ADMIN_REGENERATE', 'ADMIN_UPLOAD', 'MANUAL_COMPILER_REPAIR', 'MANUAL_VALIDATOR_REPAIR', 'COMPILE_PREVIEW');
CREATE TYPE "QuizFigureAttemptStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

ALTER TABLE "quiz_questions"
ADD COLUMN "solution_figure_mode" "QuizSolutionFigureMode" NOT NULL DEFAULT 'NONE';

CREATE TABLE "quiz_generation_request_drafts" (
  "id" UUID NOT NULL,
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
  CONSTRAINT "quiz_generation_request_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quiz_generation_request_drafts_lesson_id_created_at_idx"
ON "quiz_generation_request_drafts"("lesson_id", "created_at" DESC);
CREATE INDEX "quiz_generation_request_drafts_request_hash_idx"
ON "quiz_generation_request_drafts"("request_hash");
CREATE INDEX "quiz_generation_request_drafts_expires_at_idx"
ON "quiz_generation_request_drafts"("expires_at");

ALTER TABLE "quiz_generation_request_drafts"
ADD CONSTRAINT "quiz_generation_request_drafts_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "quiz_figures" (
  "id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "quiz_question_id" UUID NOT NULL,
  "role" "QuizFigureRole" NOT NULL,
  "ai_generation_id" UUID,
  "plan_json" JSONB,
  "subject_key" VARCHAR(24) NOT NULL,
  "subject_name" VARCHAR(120) NOT NULL,
  "subject_slug" VARCHAR(140) NOT NULL,
  "status" "QuizFigureStatus" NOT NULL DEFAULT 'QUEUED',
  "last_error_category" TEXT,
  "last_error_code" TEXT,
  "last_error_message" TEXT,
  "created_by_id" UUID,
  "current_revision_id" UUID,
  "pending_revision_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "quiz_figures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quiz_figures_quiz_question_id_role_key"
ON "quiz_figures"("quiz_question_id", "role");
CREATE UNIQUE INDEX "quiz_figures_current_revision_id_key"
ON "quiz_figures"("current_revision_id");
CREATE UNIQUE INDEX "quiz_figures_pending_revision_id_key"
ON "quiz_figures"("pending_revision_id");
CREATE INDEX "quiz_figures_lesson_id_status_idx" ON "quiz_figures"("lesson_id", "status");
CREATE INDEX "quiz_figures_quiz_question_id_deleted_at_idx" ON "quiz_figures"("quiz_question_id", "deleted_at");
CREATE INDEX "quiz_figures_ai_generation_id_idx" ON "quiz_figures"("ai_generation_id");

CREATE TABLE "quiz_figure_revisions" (
  "id" UUID NOT NULL,
  "quiz_figure_id" UUID NOT NULL,
  "source_kind" "QuizFigureSourceKind" NOT NULL DEFAULT 'AI_TEX',
  "origin" "QuizFigureRevisionOrigin" NOT NULL,
  "status" "QuizFigureRevisionStatus" NOT NULL DEFAULT 'QUEUED',
  "latex_source" TEXT,
  "source_hash" TEXT,
  "source_version" INTEGER NOT NULL,
  "derived_from_question_revision_id" UUID,
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
  CONSTRAINT "quiz_figure_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quiz_figure_revisions_quiz_figure_id_source_version_key"
ON "quiz_figure_revisions"("quiz_figure_id", "source_version");
CREATE INDEX "quiz_figure_revisions_quiz_figure_id_created_at_idx"
ON "quiz_figure_revisions"("quiz_figure_id", "created_at" DESC);
CREATE INDEX "quiz_figure_revisions_derived_from_question_revision_id_idx"
ON "quiz_figure_revisions"("derived_from_question_revision_id");
CREATE INDEX "quiz_figure_revisions_status_created_at_idx"
ON "quiz_figure_revisions"("status", "created_at");
CREATE INDEX "quiz_figure_revisions_delivery_file_id_idx"
ON "quiz_figure_revisions"("delivery_file_id");

CREATE TABLE "quiz_figure_render_attempts" (
  "id" UUID NOT NULL,
  "quiz_figure_id" UUID NOT NULL,
  "revision_id" UUID NOT NULL,
  "background_job_id" UUID,
  "attempt_number" INTEGER NOT NULL,
  "source_version" INTEGER NOT NULL,
  "kind" "QuizFigureAttemptKind" NOT NULL,
  "status" "QuizFigureAttemptStatus" NOT NULL DEFAULT 'RUNNING',
  "source_hash" TEXT NOT NULL,
  "compile_log" TEXT,
  "error_category" TEXT,
  "error_code" TEXT,
  "validator_issues_json" JSONB,
  "duration_ms" INTEGER,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_figure_render_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quiz_figure_render_attempts_quiz_figure_id_attempt_number_key"
ON "quiz_figure_render_attempts"("quiz_figure_id", "attempt_number");
CREATE INDEX "quiz_figure_render_attempts_background_job_id_idx"
ON "quiz_figure_render_attempts"("background_job_id");
CREATE INDEX "quiz_figure_render_attempts_revision_id_created_at_idx"
ON "quiz_figure_render_attempts"("revision_id", "created_at");
CREATE INDEX "quiz_figure_render_attempts_quiz_figure_id_status_idx"
ON "quiz_figure_render_attempts"("quiz_figure_id", "status");

ALTER TABLE "quiz_figures" ADD CONSTRAINT "quiz_figures_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_figures" ADD CONSTRAINT "quiz_figures_quiz_question_id_fkey"
FOREIGN KEY ("quiz_question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_figures" ADD CONSTRAINT "quiz_figures_ai_generation_id_fkey"
FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quiz_figures" ADD CONSTRAINT "quiz_figures_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quiz_figure_revisions" ADD CONSTRAINT "quiz_figure_revisions_quiz_figure_id_fkey"
FOREIGN KEY ("quiz_figure_id") REFERENCES "quiz_figures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_figure_revisions" ADD CONSTRAINT "quiz_figure_revisions_derived_from_question_revision_id_fkey"
FOREIGN KEY ("derived_from_question_revision_id") REFERENCES "quiz_figure_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quiz_figure_revisions" ADD CONSTRAINT "quiz_figure_revisions_delivery_file_id_fkey"
FOREIGN KEY ("delivery_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quiz_figure_revisions" ADD CONSTRAINT "quiz_figure_revisions_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quiz_figures" ADD CONSTRAINT "quiz_figures_current_revision_id_fkey"
FOREIGN KEY ("current_revision_id") REFERENCES "quiz_figure_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quiz_figures" ADD CONSTRAINT "quiz_figures_pending_revision_id_fkey"
FOREIGN KEY ("pending_revision_id") REFERENCES "quiz_figure_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quiz_figure_render_attempts" ADD CONSTRAINT "quiz_figure_render_attempts_quiz_figure_id_fkey"
FOREIGN KEY ("quiz_figure_id") REFERENCES "quiz_figures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_figure_render_attempts" ADD CONSTRAINT "quiz_figure_render_attempts_revision_id_fkey"
FOREIGN KEY ("revision_id") REFERENCES "quiz_figure_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_figure_render_attempts" ADD CONSTRAINT "quiz_figure_render_attempts_background_job_id_fkey"
FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
