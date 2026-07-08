-- M1.3 learning path, lesson, document, enrollment and progress models.

-- CreateEnum
CREATE TYPE "Subject" AS ENUM ('MATH', 'PHYSICS', 'CHEMISTRY');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('ADMIN', 'AI');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'APPROVED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "LessonMaterialType" AS ENUM ('PDF', 'IMAGE', 'TEXT', 'RICH_TEXT', 'LINK');

-- CreateEnum
CREATE TYPE "LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AiProviderName" AS ENUM ('OPENAI', 'GEMINI');

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" UUID NOT NULL,
    "subject" "Subject" NOT NULL,
    "grade" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "original_price_vnd" INTEGER NOT NULL,
    "sale_price_vnd" INTEGER,
    "total_lesson_count" INTEGER NOT NULL DEFAULT 0,
    "thumbnail_file_id" UUID,
    "description_json" JSONB,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "trial_enabled" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "learning_path_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "short_description" TEXT,
    "prep_material_json" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "exam_open_at" TIMESTAMP(3),
    "video_url" TEXT,
    "completion_min_score" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_materials" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "type" "LessonMaterialType" NOT NULL,
    "file_id" UUID,
    "url" TEXT,
    "title" TEXT,
    "content_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lesson_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_documents" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "title" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "extracted_text" TEXT,
    "extract_error" TEXT,
    "content_hash" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "processing_job_id" UUID,
    "processed_at" TIMESTAMP(3),
    "embedding_provider" "AiProviderName",
    "embedding_model" TEXT,
    "embedding_dimensions" INTEGER,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT,
    "token_count" INTEGER,
    "embedding" vector(1536),
    "embedding_provider" "AiProviderName",
    "embedding_model" TEXT,
    "embedding_dimensions" INTEGER,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_summaries" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "content_json" JSONB NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "ai_generation_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lesson_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "learning_path_id" UUID NOT NULL,
    "paid_by_user_id" UUID,
    "payment_id" UUID,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "best_test_attempt_id" UUID,
    "best_score" DECIMAL(5,2),
    "best_duration_seconds" INTEGER,
    "completed_at" TIMESTAMP(3),
    "xp_awarded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_slug_key" ON "learning_paths"("slug");

-- CreateIndex
CREATE INDEX "learning_paths_subject_grade_idx" ON "learning_paths"("subject", "grade");

-- CreateIndex
CREATE INDEX "learning_paths_status_idx" ON "learning_paths"("status");

-- CreateIndex
CREATE INDEX "learning_paths_sort_order_idx" ON "learning_paths"("sort_order");

-- CreateIndex
CREATE INDEX "learning_paths_thumbnail_file_id_idx" ON "learning_paths"("thumbnail_file_id");

-- CreateIndex
CREATE INDEX "learning_paths_created_by_id_idx" ON "learning_paths"("created_by_id");

-- CreateIndex
CREATE INDEX "learning_paths_updated_by_id_idx" ON "learning_paths"("updated_by_id");

-- CreateIndex
CREATE INDEX "lessons_learning_path_id_status_idx" ON "lessons"("learning_path_id", "status");

-- CreateIndex
CREATE INDEX "lessons_scheduled_at_idx" ON "lessons"("scheduled_at");

-- CreateIndex
CREATE INDEX "lessons_exam_open_at_idx" ON "lessons"("exam_open_at");

-- CreateIndex
CREATE INDEX "lessons_created_by_id_idx" ON "lessons"("created_by_id");

-- CreateIndex
CREATE INDEX "lessons_updated_by_id_idx" ON "lessons"("updated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_learning_path_id_order_index_key" ON "lessons"("learning_path_id", "order_index");

-- CreateIndex
CREATE INDEX "lesson_materials_lesson_id_sort_order_idx" ON "lesson_materials"("lesson_id", "sort_order");

-- CreateIndex
CREATE INDEX "lesson_materials_file_id_idx" ON "lesson_materials"("file_id");

-- CreateIndex
CREATE INDEX "lesson_documents_lesson_id_idx" ON "lesson_documents"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_documents_status_idx" ON "lesson_documents"("status");

-- CreateIndex
CREATE INDEX "lesson_documents_content_hash_idx" ON "lesson_documents"("content_hash");

-- CreateIndex
CREATE INDEX "lesson_documents_file_id_idx" ON "lesson_documents"("file_id");

-- CreateIndex
CREATE INDEX "lesson_documents_processing_job_id_idx" ON "lesson_documents"("processing_job_id");

-- CreateIndex
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks"("document_id");

-- CreateIndex
CREATE INDEX "document_chunks_lesson_id_idx" ON "document_chunks"("lesson_id");

-- CreateIndex
CREATE INDEX "document_chunks_lesson_id_embedding_provider_embedding_mode_idx" ON "document_chunks"("lesson_id", "embedding_provider", "embedding_model", "embedding_dimensions");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_document_id_chunk_index_key" ON "document_chunks"("document_id", "chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_summaries_lesson_id_key" ON "lesson_summaries"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_summaries_ai_generation_id_idx" ON "lesson_summaries"("ai_generation_id");

-- CreateIndex
CREATE INDEX "lesson_summaries_created_by_id_idx" ON "lesson_summaries"("created_by_id");

-- CreateIndex
CREATE INDEX "lesson_summaries_updated_by_id_idx" ON "lesson_summaries"("updated_by_id");

-- CreateIndex
CREATE INDEX "enrollments_student_user_id_learning_path_id_status_idx" ON "enrollments"("student_user_id", "learning_path_id", "status");

-- CreateIndex
CREATE INDEX "enrollments_learning_path_id_idx" ON "enrollments"("learning_path_id");

-- CreateIndex
CREATE INDEX "enrollments_paid_by_user_id_idx" ON "enrollments"("paid_by_user_id");

-- CreateIndex
CREATE INDEX "enrollments_payment_id_idx" ON "enrollments"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_one_active_per_student_path" ON "enrollments"("student_user_id", "learning_path_id") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "lesson_progress_student_user_id_status_idx" ON "lesson_progress"("student_user_id", "status");

-- CreateIndex
CREATE INDEX "lesson_progress_lesson_id_status_idx" ON "lesson_progress"("lesson_id", "status");

-- CreateIndex
CREATE INDEX "lesson_progress_best_test_attempt_id_idx" ON "lesson_progress"("best_test_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_student_user_id_lesson_id_key" ON "lesson_progress"("student_user_id", "lesson_id");

-- AddForeignKey
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_thumbnail_file_id_fkey" FOREIGN KEY ("thumbnail_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_materials" ADD CONSTRAINT "lesson_materials_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_materials" ADD CONSTRAINT "lesson_materials_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_documents" ADD CONSTRAINT "lesson_documents_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_documents" ADD CONSTRAINT "lesson_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_documents" ADD CONSTRAINT "lesson_documents_processing_job_id_fkey" FOREIGN KEY ("processing_job_id") REFERENCES "background_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "lesson_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_summaries" ADD CONSTRAINT "lesson_summaries_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_summaries" ADD CONSTRAINT "lesson_summaries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_summaries" ADD CONSTRAINT "lesson_summaries_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_paid_by_user_id_fkey" FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
