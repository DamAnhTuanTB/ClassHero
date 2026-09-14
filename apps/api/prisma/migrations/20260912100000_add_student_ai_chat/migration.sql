-- M9.6: one unified chat history with immutable LIBRARY / COURSE scopes.
CREATE TYPE "AiChatScopeType" AS ENUM ('LIBRARY', 'COURSE');
CREATE TYPE "AiChatMessageStatus" AS ENUM ('GENERATING', 'COMPLETED', 'REFUSED', 'FAILED', 'INTERRUPTED');
CREATE TYPE "AiChatResponsePolicy" AS ENUM ('HINT_ONLY', 'FULL_ANSWER', 'BLOCKED');

ALTER TYPE "FilePurpose" ADD VALUE IF NOT EXISTS 'CHAT_IMAGE';

ALTER TABLE "ai_chat_sessions"
  ADD COLUMN "scope_type" "AiChatScopeType",
  ADD COLUMN "learning_path_id" UUID,
  ADD COLUMN "last_message_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3);

UPDATE "ai_chat_sessions" AS session
SET
  "scope_type" = 'COURSE'::"AiChatScopeType",
  "learning_path_id" = lesson."learning_path_id",
  "last_message_at" = COALESCE(
    (SELECT MAX(message."created_at") FROM "ai_chat_messages" AS message WHERE message."session_id" = session."id"),
    session."updated_at"
  )
FROM "lessons" AS lesson
WHERE lesson."id" = session."lesson_id";

ALTER TABLE "ai_chat_sessions"
  ALTER COLUMN "scope_type" SET NOT NULL;

DROP INDEX IF EXISTS "ai_chat_sessions_student_user_id_lesson_id_key";
DROP INDEX IF EXISTS "ai_chat_sessions_lesson_id_idx";
ALTER TABLE "ai_chat_sessions" DROP CONSTRAINT IF EXISTS "ai_chat_sessions_lesson_id_fkey";
ALTER TABLE "ai_chat_sessions" DROP COLUMN "lesson_id";

ALTER TABLE "ai_chat_sessions"
  ADD CONSTRAINT "ai_chat_sessions_learning_path_id_fkey"
  FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_chat_sessions_scope_learning_path_check"
  CHECK (
    ("scope_type" = 'LIBRARY' AND "learning_path_id" IS NULL)
    OR ("scope_type" = 'COURSE' AND "learning_path_id" IS NOT NULL)
  );

CREATE INDEX "ai_chat_sessions_student_user_id_deleted_at_last_message_at_id_idx"
  ON "ai_chat_sessions"("student_user_id", "deleted_at", "last_message_at" DESC, "id" DESC);
CREATE INDEX "ai_chat_sessions_student_user_id_scope_type_learning_path_id_deleted_idx"
  ON "ai_chat_sessions"("student_user_id", "scope_type", "learning_path_id", "deleted_at");
CREATE INDEX "ai_chat_sessions_learning_path_id_idx"
  ON "ai_chat_sessions"("learning_path_id");

ALTER TABLE "ai_chat_messages"
  ADD COLUMN "status" "AiChatMessageStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "response_policy" "AiChatResponsePolicy" NOT NULL DEFAULT 'FULL_ANSWER',
  ADD COLUMN "surface_lesson_id" UUID,
  ADD COLUMN "target_type" TEXT,
  ADD COLUMN "target_id" UUID,
  ADD COLUMN "context_json" JSONB,
  ADD COLUMN "source_learning_path_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "source_lesson_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "error_code" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ai_chat_messages"
  ADD CONSTRAINT "ai_chat_messages_surface_lesson_id_fkey"
  FOREIGN KEY ("surface_lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ai_chat_messages_session_id_created_at_idx";
CREATE INDEX "ai_chat_messages_session_id_created_at_id_idx"
  ON "ai_chat_messages"("session_id", "created_at", "id");
CREATE INDEX "ai_chat_messages_surface_lesson_id_idx"
  ON "ai_chat_messages"("surface_lesson_id");

CREATE TABLE "ai_chat_message_attachments" (
  "id" UUID NOT NULL,
  "message_id" UUID NOT NULL,
  "file_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_chat_message_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_chat_message_attachments_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "ai_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_message_attachments_file_id_fkey"
    FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_chat_message_attachments_file_id_key"
  ON "ai_chat_message_attachments"("file_id");
CREATE UNIQUE INDEX "ai_chat_message_attachments_message_id_file_id_key"
  ON "ai_chat_message_attachments"("message_id", "file_id");
CREATE INDEX "ai_chat_message_attachments_message_id_sort_order_idx"
  ON "ai_chat_message_attachments"("message_id", "sort_order");
