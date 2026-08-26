-- Keep the migration history aligned with Lesson.customVideoSettings.
-- Existing development databases may already have this column from an
-- earlier schema synchronization, so make the repair idempotent.
ALTER TABLE "lessons"
ADD COLUMN IF NOT EXISTS "custom_video_settings" JSONB;
