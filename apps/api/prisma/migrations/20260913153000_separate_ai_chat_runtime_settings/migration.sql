-- Keep Chat response generation, query embedding and image-input limits as
-- distinct settings while retaining one Admin defaults workflow.
CREATE TABLE "ai_chat_runtime_settings" (
  "id" UUID NOT NULL,
  "singleton_key" TEXT NOT NULL DEFAULT 'default',
  "embedding_catalog_item_id" UUID,
  "max_images_per_message" INTEGER NOT NULL DEFAULT 5,
  "max_image_bytes" BIGINT NOT NULL DEFAULT 10485760,
  "allowed_image_mime_types" TEXT[] NOT NULL DEFAULT ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[],
  "student_daily_message_limit" INTEGER NOT NULL DEFAULT 20,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_chat_runtime_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_chat_runtime_settings_embedding_catalog_item_id_fkey"
    FOREIGN KEY ("embedding_catalog_item_id") REFERENCES "provider_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_runtime_settings_updated_by_user_id_fkey"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ai_chat_runtime_settings_max_images_check"
    CHECK ("max_images_per_message" BETWEEN 1 AND 10),
  CONSTRAINT "ai_chat_runtime_settings_max_image_bytes_check"
    CHECK ("max_image_bytes" BETWEEN 65536 AND 20971520),
  CONSTRAINT "ai_chat_runtime_settings_allowed_mime_types_check"
    CHECK (
      cardinality("allowed_image_mime_types") BETWEEN 1 AND 3
      AND "allowed_image_mime_types" <@ ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
    ),
  CONSTRAINT "ai_chat_runtime_settings_daily_message_limit_check"
    CHECK ("student_daily_message_limit" BETWEEN 1 AND 1000)
);

CREATE UNIQUE INDEX "ai_chat_runtime_settings_singleton_key_key"
  ON "ai_chat_runtime_settings"("singleton_key");
CREATE INDEX "ai_chat_runtime_settings_embedding_catalog_item_id_idx"
  ON "ai_chat_runtime_settings"("embedding_catalog_item_id");
CREATE INDEX "ai_chat_runtime_settings_updated_by_user_id_idx"
  ON "ai_chat_runtime_settings"("updated_by_user_id");

INSERT INTO "ai_chat_runtime_settings" (
  "id",
  "singleton_key",
  "embedding_catalog_item_id",
  "max_images_per_message",
  "max_image_bytes",
  "allowed_image_mime_types",
  "student_daily_message_limit",
  "version",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  'default',
  item."id",
  5,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[],
  20,
  1,
  CURRENT_TIMESTAMP
FROM "provider_catalog_items" item
WHERE item."category" = 'AI_MODEL'
  AND item."provider" = 'OPENAI'
  AND item."external_key" = 'text-embedding-3-small'
LIMIT 1
ON CONFLICT ("singleton_key") DO NOTHING;

INSERT INTO "ai_chat_runtime_settings" (
  "id",
  "singleton_key",
  "max_images_per_message",
  "max_image_bytes",
  "allowed_image_mime_types",
  "student_daily_message_limit",
  "version",
  "updated_at"
)
VALUES (
  gen_random_uuid(),
  'default',
  5,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[],
  20,
  1,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("singleton_key") DO NOTHING;
