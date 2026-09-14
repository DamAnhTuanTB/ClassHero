ALTER TABLE "ai_chat_runtime_settings"
ADD COLUMN "student_daily_image_limit" INTEGER NOT NULL DEFAULT 20,
ADD CONSTRAINT "ai_chat_runtime_settings_daily_image_limit_check"
  CHECK ("student_daily_image_limit" BETWEEN 0 AND 1000);

ALTER TABLE "ai_chat_message_attachments"
ADD COLUMN "daily_quota_counted_at" TIMESTAMP(3);

ALTER TABLE "ai_chat_messages"
ADD COLUMN "daily_quota_counted_at" TIMESTAMP(3);

CREATE INDEX "ai_chat_message_attachments_daily_quota_counted_at_idx"
  ON "ai_chat_message_attachments"("daily_quota_counted_at");

CREATE INDEX "ai_chat_messages_daily_quota_counted_at_idx"
  ON "ai_chat_messages"("daily_quota_counted_at");
