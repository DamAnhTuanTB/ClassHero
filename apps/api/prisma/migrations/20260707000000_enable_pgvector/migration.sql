-- M1.1 database foundation.
-- Supabase Postgres must have pgvector enabled before document chunk embeddings are added in later milestones.
CREATE EXTENSION IF NOT EXISTS vector;
