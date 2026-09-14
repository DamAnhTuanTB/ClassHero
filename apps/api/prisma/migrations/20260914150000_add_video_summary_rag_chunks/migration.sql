-- Persisted video summaries are a first-class lesson RAG source. Raw video
-- transcripts remain generation input only and are never searched by Chat AI.
CREATE TABLE "video_summary_chunks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "video_summary_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "summary_hash" TEXT NOT NULL,
  "token_count" INTEGER NOT NULL,
  "start_seconds" DOUBLE PRECISION,
  "end_seconds" DOUBLE PRECISION,
  "embedding" vector(1536),
  "embedding_provider" "AiProviderName",
  "embedding_model" TEXT,
  "embedding_dimensions" INTEGER,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "video_summary_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "video_summary_chunks_video_summary_id_fkey"
    FOREIGN KEY ("video_summary_id") REFERENCES "lesson_video_summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "video_summary_chunks_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "video_summary_chunks_video_summary_id_chunk_index_key"
  ON "video_summary_chunks"("video_summary_id", "chunk_index");
CREATE INDEX "video_summary_chunks_video_summary_id_idx"
  ON "video_summary_chunks"("video_summary_id");
CREATE INDEX "video_summary_chunks_lesson_id_idx"
  ON "video_summary_chunks"("lesson_id");
CREATE INDEX "video_summary_chunks_lesson_id_summary_hash_idx"
  ON "video_summary_chunks"("lesson_id", "summary_hash");
CREATE INDEX "video_summary_chunks_lesson_id_embedding_space_idx"
  ON "video_summary_chunks"(
    "lesson_id",
    "embedding_provider",
    "embedding_model",
    "embedding_dimensions"
  );
CREATE INDEX "idx_video_summary_chunks_embedding_hnsw"
  ON "video_summary_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
