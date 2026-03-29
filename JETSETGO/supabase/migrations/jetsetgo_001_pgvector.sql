-- JETSETGO Migration 001: Enable pgvector extension
-- This enables vector similarity search capabilities

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Grant usage on vector type to authenticated and anon users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Comment
COMMENT ON EXTENSION vector IS 'Vector similarity search for RAG system';
