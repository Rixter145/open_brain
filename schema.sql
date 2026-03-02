-- Open Brain: Postgres + pgvector schema
-- Run this once (e.g. in Supabase SQL editor or psql) before starting the MCP server.
-- Requires: Postgres 15+ with pgvector extension.

CREATE EXTENSION IF NOT EXISTS vector;

-- Single table for thoughts. Embedding dimension must match OpenAI text-embedding-3-small (1536).
CREATE TABLE IF NOT EXISTS thoughts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
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

-- Optional: store which embedding model was used (for consistency checks).
COMMENT ON COLUMN thoughts.embedding IS 'OpenAI text-embedding-3-small, 1536 dimensions';
