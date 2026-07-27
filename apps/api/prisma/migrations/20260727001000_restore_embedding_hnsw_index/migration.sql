-- Compensating migration: the original HNSW migration is recorded as applied
-- in existing environments where the physical index may still be absent.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
