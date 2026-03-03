-- Open Brain: Postgres + pgvector schema (Ollama nomic-embed-text)
-- Run this once when using EMBEDDING_PROVIDER=ollama (768 dimensions).
-- If you already have a thoughts table with vector(1536), run: DROP TABLE IF EXISTS thoughts; then run this file.
-- Requires: Postgres 15+ with pgvector extension.

CREATE EXTENSION IF NOT EXISTS vector;

-- Single table for thoughts. Embedding dimension must match Ollama nomic-embed-text (768).
CREATE TABLE IF NOT EXISTS thoughts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  people TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  type TEXT,
  action_items TEXT[] DEFAULT '{}',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HNSW index for fast approximate nearest-neighbor search (cosine distance).
CREATE INDEX IF NOT EXISTS thoughts_embedding_idx ON thoughts
  USING hnsw (embedding vector_cosine_ops);

-- Optional: index for recent listing and filtering by time.
CREATE INDEX IF NOT EXISTS thoughts_created_at_idx ON thoughts (created_at DESC);

COMMENT ON COLUMN thoughts.embedding IS 'Ollama nomic-embed-text, 768 dimensions';
