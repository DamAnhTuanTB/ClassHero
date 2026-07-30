CREATE TABLE "flashcard_study_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "flashcard_set_id" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "reviewed_count" INTEGER NOT NULL DEFAULT 0,
    "known_count" INTEGER NOT NULL DEFAULT 0,
    "unknown_count" INTEGER NOT NULL DEFAULT 0,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcard_study_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flashcard_study_session_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "flashcard_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_known" BOOLEAN,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcard_study_session_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flashcard_study_sessions_student_user_id_lesson_id_started_idx"
ON "flashcard_study_sessions"("student_user_id", "lesson_id", "started_at");

CREATE INDEX "flashcard_study_sessions_flashcard_set_id_idx"
ON "flashcard_study_sessions"("flashcard_set_id");

CREATE INDEX "flashcard_study_sessions_status_idx"
ON "flashcard_study_sessions"("status");

CREATE UNIQUE INDEX "flashcard_study_session_items_session_id_flashcard_id_key"
ON "flashcard_study_session_items"("session_id", "flashcard_id");

CREATE INDEX "flashcard_study_session_items_flashcard_id_idx"
ON "flashcard_study_session_items"("flashcard_id");

ALTER TABLE "flashcard_study_sessions"
ADD CONSTRAINT "flashcard_study_sessions_student_user_id_fkey"
FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flashcard_study_sessions"
ADD CONSTRAINT "flashcard_study_sessions_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flashcard_study_sessions"
ADD CONSTRAINT "flashcard_study_sessions_flashcard_set_id_fkey"
FOREIGN KEY ("flashcard_set_id") REFERENCES "flashcard_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "flashcard_study_session_items"
ADD CONSTRAINT "flashcard_study_session_items_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "flashcard_study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "flashcard_study_session_items"
ADD CONSTRAINT "flashcard_study_session_items_flashcard_id_fkey"
FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
