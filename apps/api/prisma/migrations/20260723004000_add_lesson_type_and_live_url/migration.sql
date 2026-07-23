CREATE TYPE "LessonType" AS ENUM ('BASIC', 'LIVE');

ALTER TABLE "lessons"
ADD COLUMN "lesson_type" "LessonType" NOT NULL DEFAULT 'BASIC',
ADD COLUMN "live_url" TEXT;

ALTER TABLE "lessons"
ADD CONSTRAINT "lessons_live_url_requires_live_type"
CHECK ("lesson_type" = 'LIVE' OR "live_url" IS NULL);
