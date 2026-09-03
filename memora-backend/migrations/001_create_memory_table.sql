-- 001_create_memory_table.sql: Initialize pgvector and memories table

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY,
    text TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decay_score DOUBLE PRECISION NOT NULL DEFAULT 1.0
);

-- Cosine Distance HNSW Index for sub-millisecond retrieval
CREATE INDEX IF NOT EXISTS idx_memories_embedding_hnsw 
ON memories 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_decay_score ON memories(decay_score);
