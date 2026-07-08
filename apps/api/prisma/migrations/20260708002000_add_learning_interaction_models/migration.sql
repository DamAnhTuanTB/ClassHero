-- M1.4 quiz, flashcard, test, attempt and learning interaction models.

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'MIXED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FavoriteTargetType" AS ENUM ('QUIZ_QUESTION', 'FLASHCARD');

-- CreateTable
CREATE TABLE "quiz_sets" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MIXED',
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "is_reserve" BOOLEAN NOT NULL DEFAULT false,
    "generated_by_user_id" UUID,
    "ai_generation_id" UUID,
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quiz_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "quiz_set_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "question_json" JSONB NOT NULL,
    "options_json" JSONB,
    "correct_answer_json" JSONB NOT NULL,
    "hint_json" JSONB,
    "grading_config_json" JSONB,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "explanation_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "quiz_set_id" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "wrong_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempt_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_json" JSONB NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard_sets" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MIXED',
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "is_reserve" BOOLEAN NOT NULL DEFAULT false,
    "generated_by_user_id" UUID,
    "ai_generation_id" UUID,
    "card_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "flashcard_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" UUID NOT NULL,
    "flashcard_set_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "front_json" JSONB NOT NULL,
    "back_json" JSONB NOT NULL,
    "hint_json" JSONB,
    "explanation_id" UUID,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard_progress" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "flashcard_id" UUID NOT NULL,
    "is_known" BOOLEAN NOT NULL DEFAULT false,
    "last_reviewed_at" TIMESTAMP(3) NOT NULL,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcard_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_sets" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MIXED',
    "difficulty_ratio_json" JSONB,
    "source" "ContentSource" NOT NULL DEFAULT 'ADMIN',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "is_reserve" BOOLEAN NOT NULL DEFAULT false,
    "generated_by_user_id" UUID,
    "ai_generation_id" UUID,
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "total_score" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "id" UUID NOT NULL,
    "test_set_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "question_json" JSONB NOT NULL,
    "options_json" JSONB,
    "correct_answer_json" JSONB NOT NULL,
    "hint_json" JSONB,
    "grading_config_json" JSONB,
    "points" DECIMAL(5,2),
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "explanation_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempts" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "test_set_id" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "score" DECIMAL(5,2),
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "wrong_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "is_best_for_lesson" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempt_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_json" JSONB NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "points_awarded" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_notes" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "content_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_video_comments" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "content_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lesson_video_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "target_type" "FavoriteTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_sets_lesson_id_sort_order_idx" ON "quiz_sets"("lesson_id", "sort_order");

-- CreateIndex
CREATE INDEX "quiz_sets_lesson_id_review_status_idx" ON "quiz_sets"("lesson_id", "review_status");

-- CreateIndex
CREATE INDEX "quiz_sets_generated_by_user_id_idx" ON "quiz_sets"("generated_by_user_id");

-- CreateIndex
CREATE INDEX "quiz_sets_ai_generation_id_idx" ON "quiz_sets"("ai_generation_id");

-- CreateIndex
CREATE INDEX "quiz_sets_created_by_id_idx" ON "quiz_sets"("created_by_id");

-- CreateIndex
CREATE INDEX "quiz_sets_updated_by_id_idx" ON "quiz_sets"("updated_by_id");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_set_id_sort_order_idx" ON "quiz_questions"("quiz_set_id", "sort_order");

-- CreateIndex
CREATE INDEX "quiz_questions_lesson_id_idx" ON "quiz_questions"("lesson_id");

-- CreateIndex
CREATE INDEX "quiz_questions_lesson_id_review_status_idx" ON "quiz_questions"("lesson_id", "review_status");

-- CreateIndex
CREATE INDEX "quiz_questions_explanation_id_idx" ON "quiz_questions"("explanation_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_student_user_id_lesson_id_idx" ON "quiz_attempts"("student_user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_lesson_id_idx" ON "quiz_attempts"("lesson_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_set_id_idx" ON "quiz_attempts"("quiz_set_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_status_idx" ON "quiz_attempts"("status");

-- CreateIndex
CREATE INDEX "quiz_attempt_answers_question_id_idx" ON "quiz_attempt_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempt_answers_attempt_id_question_id_key" ON "quiz_attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "flashcard_sets_lesson_id_sort_order_idx" ON "flashcard_sets"("lesson_id", "sort_order");

-- CreateIndex
CREATE INDEX "flashcard_sets_lesson_id_review_status_idx" ON "flashcard_sets"("lesson_id", "review_status");

-- CreateIndex
CREATE INDEX "flashcard_sets_generated_by_user_id_idx" ON "flashcard_sets"("generated_by_user_id");

-- CreateIndex
CREATE INDEX "flashcard_sets_ai_generation_id_idx" ON "flashcard_sets"("ai_generation_id");

-- CreateIndex
CREATE INDEX "flashcard_sets_created_by_id_idx" ON "flashcard_sets"("created_by_id");

-- CreateIndex
CREATE INDEX "flashcard_sets_updated_by_id_idx" ON "flashcard_sets"("updated_by_id");

-- CreateIndex
CREATE INDEX "flashcards_flashcard_set_id_sort_order_idx" ON "flashcards"("flashcard_set_id", "sort_order");

-- CreateIndex
CREATE INDEX "flashcards_lesson_id_idx" ON "flashcards"("lesson_id");

-- CreateIndex
CREATE INDEX "flashcards_lesson_id_review_status_idx" ON "flashcards"("lesson_id", "review_status");

-- CreateIndex
CREATE INDEX "flashcards_explanation_id_idx" ON "flashcards"("explanation_id");

-- CreateIndex
CREATE INDEX "flashcard_progress_student_user_id_lesson_id_idx" ON "flashcard_progress"("student_user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "flashcard_progress_lesson_id_idx" ON "flashcard_progress"("lesson_id");

-- CreateIndex
CREATE INDEX "flashcard_progress_flashcard_id_idx" ON "flashcard_progress"("flashcard_id");

-- CreateIndex
CREATE UNIQUE INDEX "flashcard_progress_student_user_id_flashcard_id_key" ON "flashcard_progress"("student_user_id", "flashcard_id");

-- CreateIndex
CREATE INDEX "test_sets_lesson_id_sort_order_idx" ON "test_sets"("lesson_id", "sort_order");

-- CreateIndex
CREATE INDEX "test_sets_lesson_id_review_status_idx" ON "test_sets"("lesson_id", "review_status");

-- CreateIndex
CREATE INDEX "test_sets_generated_by_user_id_idx" ON "test_sets"("generated_by_user_id");

-- CreateIndex
CREATE INDEX "test_sets_ai_generation_id_idx" ON "test_sets"("ai_generation_id");

-- CreateIndex
CREATE INDEX "test_sets_created_by_id_idx" ON "test_sets"("created_by_id");

-- CreateIndex
CREATE INDEX "test_sets_updated_by_id_idx" ON "test_sets"("updated_by_id");

-- CreateIndex
CREATE INDEX "test_questions_test_set_id_sort_order_idx" ON "test_questions"("test_set_id", "sort_order");

-- CreateIndex
CREATE INDEX "test_questions_lesson_id_idx" ON "test_questions"("lesson_id");

-- CreateIndex
CREATE INDEX "test_questions_lesson_id_review_status_idx" ON "test_questions"("lesson_id", "review_status");

-- CreateIndex
CREATE INDEX "test_questions_explanation_id_idx" ON "test_questions"("explanation_id");

-- CreateIndex
CREATE INDEX "test_attempts_student_user_id_lesson_id_idx" ON "test_attempts"("student_user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "test_attempts_lesson_id_score_duration_seconds_idx" ON "test_attempts"("lesson_id", "score", "duration_seconds");

-- CreateIndex
CREATE INDEX "test_attempts_test_set_id_idx" ON "test_attempts"("test_set_id");

-- CreateIndex
CREATE INDEX "test_attempts_status_idx" ON "test_attempts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempts_one_best_per_student_lesson" ON "test_attempts"("student_user_id", "lesson_id") WHERE "is_best_for_lesson" = true;

-- CreateIndex
CREATE INDEX "test_attempt_answers_question_id_idx" ON "test_attempt_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempt_answers_attempt_id_question_id_key" ON "test_attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "student_notes_student_user_id_lesson_id_idx" ON "student_notes"("student_user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "student_notes_lesson_id_idx" ON "student_notes"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_video_comments_student_user_id_lesson_id_idx" ON "lesson_video_comments"("student_user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "lesson_video_comments_lesson_id_idx" ON "lesson_video_comments"("lesson_id");

-- CreateIndex
CREATE INDEX "favorites_student_user_id_lesson_id_idx" ON "favorites"("student_user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "favorites_lesson_id_target_type_idx" ON "favorites"("lesson_id", "target_type");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_student_user_id_target_type_target_id_key" ON "favorites"("student_user_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_best_test_attempt_id_fkey" FOREIGN KEY ("best_test_attempt_id") REFERENCES "test_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_set_id_fkey" FOREIGN KEY ("quiz_set_id") REFERENCES "quiz_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_set_id_fkey" FOREIGN KEY ("quiz_set_id") REFERENCES "quiz_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_flashcard_set_id_fkey" FOREIGN KEY ("flashcard_set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_progress" ADD CONSTRAINT "flashcard_progress_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_progress" ADD CONSTRAINT "flashcard_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_progress" ADD CONSTRAINT "flashcard_progress_flashcard_id_fkey" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sets" ADD CONSTRAINT "test_sets_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sets" ADD CONSTRAINT "test_sets_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sets" ADD CONSTRAINT "test_sets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sets" ADD CONSTRAINT "test_sets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_set_id_fkey" FOREIGN KEY ("test_set_id") REFERENCES "test_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_test_set_id_fkey" FOREIGN KEY ("test_set_id") REFERENCES "test_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "test_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_video_comments" ADD CONSTRAINT "lesson_video_comments_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_video_comments" ADD CONSTRAINT "lesson_video_comments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
