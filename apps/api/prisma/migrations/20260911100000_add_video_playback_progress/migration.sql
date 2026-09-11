CREATE TABLE "video_playback_progress" (
  "id" UUID NOT NULL,
  "student_user_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "timeline_version" VARCHAR(64) NOT NULL,
  "last_position_seconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "video_playback_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_playback_progress_student_user_id_lesson_id_key"
ON "video_playback_progress"("student_user_id", "lesson_id");

CREATE INDEX "video_playback_progress_lesson_id_updated_at_idx"
ON "video_playback_progress"("lesson_id", "updated_at");

ALTER TABLE "video_playback_progress"
ADD CONSTRAINT "video_playback_progress_student_user_id_fkey"
FOREIGN KEY ("student_user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "video_playback_progress"
ADD CONSTRAINT "video_playback_progress_lesson_id_fkey"
FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
