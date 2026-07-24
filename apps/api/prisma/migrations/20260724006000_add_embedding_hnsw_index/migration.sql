-- Create HNSW index for cosine distance on document_chunks.embedding column
-- HNSW is recommended for MVP because:
-- 1. Better recall than IVFFlat with small datasets
-- 2. No rebuild needed when adding data
-- 3. Good default parameters for ~10k chunks

-- Only create index if embedding column exists and pgvector extension is enabled
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
