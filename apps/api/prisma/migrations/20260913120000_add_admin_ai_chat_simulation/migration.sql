-- M9.34: Admin AI-chat simulation reuses the Student Chat runtime while keeping
-- admin ownership, normalized immutable scope and per-turn request snapshots.
ALTER TYPE "AiChatScopeType" ADD VALUE IF NOT EXISTS 'LESSON';
ALTER TYPE "AiChatScopeType" ADD VALUE IF NOT EXISTS 'COURSE_SET';

CREATE TYPE "AiChatSessionMode" AS ENUM ('STUDENT', 'ADMIN_SIMULATION');

ALTER TABLE "ai_chat_sessions"
  DROP CONSTRAINT IF EXISTS "ai_chat_sessions_scope_learning_path_check";

ALTER TABLE "ai_chat_sessions"
  ALTER COLUMN "student_user_id" DROP NOT NULL,
  ADD COLUMN "mode" "AiChatSessionMode" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "admin_user_id" UUID,
  ADD COLUMN "configuration_override_json" JSONB,
  ADD COLUMN "configuration_version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ai_chat_sessions"
  ADD CONSTRAINT "ai_chat_sessions_admin_user_id_fkey"
  FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_chat_sessions_owner_mode_check"
  CHECK (
    ("mode" = 'STUDENT' AND "student_user_id" IS NOT NULL AND "admin_user_id" IS NULL
      AND "scope_type" IN ('LIBRARY', 'COURSE'))
    OR
    ("mode" = 'ADMIN_SIMULATION' AND "student_user_id" IS NULL AND "admin_user_id" IS NOT NULL
      AND "scope_type" IN ('LESSON', 'COURSE', 'COURSE_SET'))
  ),
  ADD CONSTRAINT "ai_chat_sessions_scope_learning_path_check"
  CHECK (
    ("scope_type" = 'LIBRARY' AND "learning_path_id" IS NULL)
    OR ("scope_type" = 'COURSE' AND "learning_path_id" IS NOT NULL)
    OR ("scope_type" IN ('LESSON', 'COURSE_SET'))
  );

CREATE INDEX "ai_chat_sessions_admin_user_id_deleted_at_last_message_at_id_idx"
  ON "ai_chat_sessions"("admin_user_id", "deleted_at", "last_message_at" DESC, "id" DESC);
CREATE INDEX "ai_chat_sessions_admin_user_id_scope_type_deleted_at_idx"
  ON "ai_chat_sessions"("admin_user_id", "scope_type", "deleted_at");

CREATE TABLE "ai_chat_session_scope_items" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "learning_path_id" UUID NOT NULL,
  "lesson_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_chat_session_scope_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_chat_session_scope_items_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_session_scope_items_learning_path_id_fkey"
    FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_session_scope_items_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_chat_session_scope_items_session_id_learning_path_id_lesson_id_key"
  ON "ai_chat_session_scope_items"("session_id", "learning_path_id", "lesson_id");
CREATE INDEX "ai_chat_session_scope_items_session_id_sort_order_id_idx"
  ON "ai_chat_session_scope_items"("session_id", "sort_order", "id");
CREATE INDEX "ai_chat_session_scope_items_learning_path_id_idx"
  ON "ai_chat_session_scope_items"("learning_path_id");
CREATE INDEX "ai_chat_session_scope_items_lesson_id_idx"
  ON "ai_chat_session_scope_items"("lesson_id");

CREATE TABLE "ai_chat_turn_traces" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "user_message_id" UUID NOT NULL,
  "assistant_message_id" UUID NOT NULL,
  "ai_generation_id" UUID NOT NULL,
  "scope_snapshot_json" JSONB NOT NULL,
  "default_configuration_version" INTEGER NOT NULL,
  "session_configuration_version" INTEGER NOT NULL,
  "configuration_override_snapshot_json" JSONB,
  "effective_configuration_json" JSONB NOT NULL,
  "provider_request_snapshot_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_chat_turn_traces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_chat_turn_traces_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_turn_traces_user_message_id_fkey"
    FOREIGN KEY ("user_message_id") REFERENCES "ai_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_turn_traces_assistant_message_id_fkey"
    FOREIGN KEY ("assistant_message_id") REFERENCES "ai_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_turn_traces_ai_generation_id_fkey"
    FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ai_chat_turn_traces_user_message_id_key"
  ON "ai_chat_turn_traces"("user_message_id");
CREATE UNIQUE INDEX "ai_chat_turn_traces_assistant_message_id_key"
  ON "ai_chat_turn_traces"("assistant_message_id");
CREATE UNIQUE INDEX "ai_chat_turn_traces_ai_generation_id_key"
  ON "ai_chat_turn_traces"("ai_generation_id");
CREATE INDEX "ai_chat_turn_traces_session_id_created_at_id_idx"
  ON "ai_chat_turn_traces"("session_id", "created_at", "id");
