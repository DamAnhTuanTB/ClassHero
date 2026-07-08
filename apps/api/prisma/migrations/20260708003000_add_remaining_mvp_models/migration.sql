-- M1.5 payment, notification, report, AI log, gamification and news models.

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYOS');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('SYSTEM', 'MANUAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LESSON_REMINDER', 'TEST_OPENED', 'LESSON_COMPLETED', 'TEST_RESULT', 'STUDY_LATE', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'ZALO');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('QUIZ_QUESTION', 'FLASHCARD', 'TEST_QUESTION');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('EDIT', 'HIDE', 'RESTORE', 'MARK_RESOLVED', 'REJECT');

-- CreateEnum
CREATE TYPE "AiGenerationType" AS ENUM ('SUMMARY', 'QUIZ', 'FLASHCARD', 'TEST', 'EXPLANATION', 'CHAT', 'EMBEDDING', 'DOCUMENT_EXTRACT', 'DIAGRAM_RENDER');

-- CreateEnum
CREATE TYPE "AiGenerationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiExplanationTargetType" AS ENUM ('QUIZ_QUESTION', 'FLASHCARD', 'TEST_QUESTION');

-- CreateEnum
CREATE TYPE "AiChatMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "XpEventSource" AS ENUM ('LESSON_COMPLETED', 'BONUS', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "NewsType" AS ENUM ('NEWS', 'EVENT', 'LIVESTREAM');

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYOS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payer_user_id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "learning_path_id" UUID NOT NULL,
    "discount_code_id" UUID,
    "idempotency_key" TEXT,
    "provider_order_code" TEXT NOT NULL,
    "provider_payment_link_id" TEXT,
    "checkout_url" TEXT,
    "qr_code" TEXT,
    "amount_vnd" INTEGER NOT NULL,
    "original_amount_vnd" INTEGER NOT NULL,
    "discount_amount_vnd" INTEGER NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "raw_response_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_logs" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYOS',
    "event_id" TEXT,
    "provider_order_code" TEXT,
    "raw_payload_json" JSONB NOT NULL,
    "signature" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processing_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payment_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "kind" "NotificationKind" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data_json" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_actions" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" UUID NOT NULL,
    "type" "AiGenerationType" NOT NULL,
    "status" "AiGenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" "AiProviderName",
    "model" TEXT,
    "created_by_user_id" UUID,
    "lesson_id" UUID,
    "background_job_id" UUID,
    "target_type" TEXT,
    "target_id" UUID,
    "prompt_version" TEXT,
    "schema_version" TEXT,
    "input_hash" TEXT,
    "output_hash" TEXT,
    "input_meta_json" JSONB,
    "output_json" JSONB,
    "error_message" TEXT,
    "provider_request_id" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "total_tokens" INTEGER,
    "estimated_cost_vnd" INTEGER,
    "latency_ms" INTEGER,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_explanations" (
    "id" UUID NOT NULL,
    "target_type" "AiExplanationTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "content_json" JSONB NOT NULL,
    "diagram_spec_json" JSONB,
    "image_file_id" UUID,
    "source" "ContentSource" NOT NULL DEFAULT 'AI',
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'APPROVED',
    "ai_generation_id" UUID,
    "target_content_hash" TEXT,
    "source_context_hash" TEXT,
    "stale_at" TIMESTAMP(3),
    "regenerated_from_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "title" TEXT,
    "summary_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "role" "AiChatMessageRole" NOT NULL,
    "content_json" JSONB NOT NULL,
    "retrieved_chunk_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "ai_generation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_summaries" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "summary_text" TEXT NOT NULL,
    "message_count" INTEGER NOT NULL,
    "ai_generation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_events" (
    "id" UUID NOT NULL,
    "student_user_id" UUID NOT NULL,
    "lesson_id" UUID,
    "source" "XpEventSource" NOT NULL,
    "source_ref_id" UUID,
    "idempotency_key" TEXT,
    "xp" INTEGER NOT NULL,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" UUID NOT NULL,
    "type" "NewsType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content_json" JSONB NOT NULL,
    "cover_file_id" UUID,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "livestream_url" TEXT,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- CreateIndex
CREATE INDEX "discount_codes_is_active_idx" ON "discount_codes"("is_active");

-- CreateIndex
CREATE INDEX "discount_codes_starts_at_ends_at_idx" ON "discount_codes"("starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "discount_codes_created_by_id_idx" ON "discount_codes"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_order_code_key" ON "payments"("provider_order_code");

-- CreateIndex
CREATE INDEX "payments_payer_user_id_status_idx" ON "payments"("payer_user_id", "status");

-- CreateIndex
CREATE INDEX "payments_student_user_id_learning_path_id_status_idx" ON "payments"("student_user_id", "learning_path_id", "status");

-- CreateIndex
CREATE INDEX "payments_learning_path_id_idx" ON "payments"("learning_path_id");

-- CreateIndex
CREATE INDEX "payments_discount_code_id_idx" ON "payments"("discount_code_id");

-- CreateIndex
CREATE INDEX "payments_idempotency_key_idx" ON "payments"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_per_purchase" ON "payments"("payer_user_id", "student_user_id", "learning_path_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_logs_event_id_key" ON "payment_webhook_logs"("event_id");

-- CreateIndex
CREATE INDEX "payment_webhook_logs_provider_order_code_idx" ON "payment_webhook_logs"("provider_order_code");

-- CreateIndex
CREATE INDEX "payment_webhook_logs_verified_processed_idx" ON "payment_webhook_logs"("verified", "processed");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_created_at_idx" ON "notifications"("recipient_user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_read_at_idx" ON "notifications"("recipient_user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_actor_user_id_idx" ON "notifications"("actor_user_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_status_idx" ON "notification_deliveries"("channel", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "notification_deliveries_provider_message_id_idx" ON "notification_deliveries"("provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_lesson_id_idx" ON "reports"("lesson_id");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_idx" ON "reports"("reporter_user_id");

-- CreateIndex
CREATE INDEX "report_actions_report_id_idx" ON "report_actions"("report_id");

-- CreateIndex
CREATE INDEX "report_actions_admin_user_id_idx" ON "report_actions"("admin_user_id");

-- CreateIndex
CREATE INDEX "ai_generations_lesson_id_type_status_idx" ON "ai_generations"("lesson_id", "type", "status");

-- CreateIndex
CREATE INDEX "ai_generations_background_job_id_idx" ON "ai_generations"("background_job_id");

-- CreateIndex
CREATE INDEX "ai_generations_target_type_target_id_idx" ON "ai_generations"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "ai_generations_created_by_user_id_idx" ON "ai_generations"("created_by_user_id");

-- CreateIndex
CREATE INDEX "ai_generations_status_idx" ON "ai_generations"("status");

-- CreateIndex
CREATE INDEX "ai_explanations_lesson_id_idx" ON "ai_explanations"("lesson_id");

-- CreateIndex
CREATE INDEX "ai_explanations_image_file_id_idx" ON "ai_explanations"("image_file_id");

-- CreateIndex
CREATE INDEX "ai_explanations_ai_generation_id_idx" ON "ai_explanations"("ai_generation_id");

-- CreateIndex
CREATE INDEX "ai_explanations_regenerated_from_id_idx" ON "ai_explanations"("regenerated_from_id");

-- CreateIndex
CREATE INDEX "ai_explanations_review_status_idx" ON "ai_explanations"("review_status");

-- CreateIndex
CREATE INDEX "ai_explanations_stale_at_idx" ON "ai_explanations"("stale_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_explanations_target_type_target_id_key" ON "ai_explanations"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_lesson_id_idx" ON "ai_chat_sessions"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_chat_sessions_student_user_id_lesson_id_key" ON "ai_chat_sessions"("student_user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "ai_chat_messages_session_id_created_at_idx" ON "ai_chat_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_chat_messages_ai_generation_id_idx" ON "ai_chat_messages"("ai_generation_id");

-- CreateIndex
CREATE INDEX "conversation_summaries_session_id_idx" ON "conversation_summaries"("session_id");

-- CreateIndex
CREATE INDEX "conversation_summaries_ai_generation_id_idx" ON "conversation_summaries"("ai_generation_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_events_idempotency_key_key" ON "xp_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "xp_events_student_user_id_created_at_idx" ON "xp_events"("student_user_id", "created_at");

-- CreateIndex
CREATE INDEX "xp_events_lesson_id_idx" ON "xp_events"("lesson_id");

-- CreateIndex
CREATE INDEX "xp_events_source_source_ref_id_idx" ON "xp_events"("source", "source_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_items_slug_key" ON "news_items"("slug");

-- CreateIndex
CREATE INDEX "news_items_type_status_idx" ON "news_items"("type", "status");

-- CreateIndex
CREATE INDEX "news_items_status_published_at_idx" ON "news_items"("status", "published_at");

-- CreateIndex
CREATE INDEX "news_items_cover_file_id_idx" ON "news_items"("cover_file_id");

-- CreateIndex
CREATE INDEX "news_items_created_by_id_idx" ON "news_items"("created_by_id");

-- CreateIndex
CREATE INDEX "news_items_updated_by_id_idx" ON "news_items"("updated_by_id");

-- AddForeignKey
ALTER TABLE "lesson_summaries" ADD CONSTRAINT "lesson_summaries_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sets" ADD CONSTRAINT "quiz_sets_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_explanation_id_fkey" FOREIGN KEY ("explanation_id") REFERENCES "ai_explanations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_sets" ADD CONSTRAINT "flashcard_sets_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_explanation_id_fkey" FOREIGN KEY ("explanation_id") REFERENCES "ai_explanations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sets" ADD CONSTRAINT "test_sets_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_explanation_id_fkey" FOREIGN KEY ("explanation_id") REFERENCES "ai_explanations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_discount_code_id_fkey" FOREIGN KEY ("discount_code_id") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_actions" ADD CONSTRAINT "report_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_actions" ADD CONSTRAINT "report_actions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_background_job_id_fkey" FOREIGN KEY ("background_job_id") REFERENCES "background_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explanations" ADD CONSTRAINT "ai_explanations_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explanations" ADD CONSTRAINT "ai_explanations_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explanations" ADD CONSTRAINT "ai_explanations_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explanations" ADD CONSTRAINT "ai_explanations_regenerated_from_id_fkey" FOREIGN KEY ("regenerated_from_id") REFERENCES "ai_explanations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_ai_generation_id_fkey" FOREIGN KEY ("ai_generation_id") REFERENCES "ai_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_student_user_id_fkey" FOREIGN KEY ("student_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
