-- =============================================================================
-- Migration: Knowledge Chunks for RAG (Retrieval-Augmented Generation)
-- =============================================================================
-- Run this migration in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This enables pgvector and creates the KnowledgeChunks table for semantic search.
-- =============================================================================

-- 1. Enable pgvector extension (Supabase has it pre-installed, just needs enabling)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the KnowledgeChunks table
CREATE TABLE IF NOT EXISTS "KnowledgeChunks" (
  id BIGSERIAL PRIMARY KEY,
  
  -- Document metadata
  "documentId" TEXT NOT NULL,           -- Unique identifier for the source document
  "documentTitle" TEXT NOT NULL,        -- Human-readable title
  "documentType" TEXT NOT NULL,         -- 'methodology', 'protocol', 'guideline', 'faq'
  "category" TEXT NOT NULL,             -- 'disc', 'neurovendas', 'rapport', 'objection_handling', 'clinical', 'communication'
  
  -- Chunk content
  "chunkIndex" INTEGER NOT NULL,        -- Position within the document
  "content" TEXT NOT NULL,              -- The actual text content of the chunk
  "contentTokens" INTEGER NOT NULL DEFAULT 0, -- Approximate token count
  
  -- Embedding vector (1536 dimensions for text-embedding-3-small, 768 for alternatives)
  "embedding" vector(1536),             -- Nullable until embeddings are generated
  
  -- Full-text search column (fallback when embeddings unavailable)
  "searchVector" tsvector,              -- Generated from content for FTS
  
  -- Metadata
  "metadata" JSONB DEFAULT '{}',        -- Additional structured metadata
  "clinicId" INTEGER,                   -- NULL = global knowledge, non-NULL = clinic-specific
  "version" INTEGER NOT NULL DEFAULT 1, -- Document version for updates
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Timestamps
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE("documentId", "chunkIndex", "version")
);

-- 3. Create indexes for efficient retrieval
-- Full-text search index (primary retrieval method until embeddings are available)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search 
  ON "KnowledgeChunks" USING GIN ("searchVector");

-- Category + type filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_category 
  ON "KnowledgeChunks" ("category", "documentType") 
  WHERE "isActive" = TRUE;

-- Clinic isolation
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_clinic 
  ON "KnowledgeChunks" ("clinicId") 
  WHERE "isActive" = TRUE;

-- Vector similarity search (IVFFlat for approximate nearest neighbor)
-- Note: Only create after inserting initial data (needs rows for training)
-- CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding 
--   ON "KnowledgeChunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- 4. Create function to auto-update searchVector on insert/update
CREATE OR REPLACE FUNCTION update_knowledge_chunk_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := to_tsvector('portuguese', COALESCE(NEW."content", '') || ' ' || COALESCE(NEW."documentTitle", ''));
  NEW."updatedAt" := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for auto-updating searchVector
DROP TRIGGER IF EXISTS trg_knowledge_chunk_search_vector ON "KnowledgeChunks";
CREATE TRIGGER trg_knowledge_chunk_search_vector
  BEFORE INSERT OR UPDATE OF "content", "documentTitle"
  ON "KnowledgeChunks"
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_chunk_search_vector();

-- 6. Create RPC function for full-text search (used by the application)
CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  query_text TEXT,
  category_filter TEXT DEFAULT NULL,
  clinic_id_filter INTEGER DEFAULT NULL,
  max_results INTEGER DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  "documentId" TEXT,
  "documentTitle" TEXT,
  "documentType" TEXT,
  "category" TEXT,
  "content" TEXT,
  "metadata" JSONB,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kc.id,
    kc."documentId",
    kc."documentTitle",
    kc."documentType",
    kc."category",
    kc."content",
    kc."metadata",
    ts_rank(kc."searchVector", plainto_tsquery('portuguese', query_text)) AS rank
  FROM "KnowledgeChunks" kc
  WHERE 
    kc."isActive" = TRUE
    AND (category_filter IS NULL OR kc."category" = category_filter)
    AND (clinic_id_filter IS NULL OR kc."clinicId" IS NULL OR kc."clinicId" = clinic_id_filter)
    AND kc."searchVector" @@ plainto_tsquery('portuguese', query_text)
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- 7. Create RPC function for vector similarity search (future use with embeddings)
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  category_filter TEXT DEFAULT NULL,
  clinic_id_filter INTEGER DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  "documentId" TEXT,
  "documentTitle" TEXT,
  "documentType" TEXT,
  "category" TEXT,
  "content" TEXT,
  "metadata" JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kc.id,
    kc."documentId",
    kc."documentTitle",
    kc."documentType",
    kc."category",
    kc."content",
    kc."metadata",
    1 - (kc."embedding" <=> query_embedding) AS similarity
  FROM "KnowledgeChunks" kc
  WHERE 
    kc."isActive" = TRUE
    AND kc."embedding" IS NOT NULL
    AND (category_filter IS NULL OR kc."category" = category_filter)
    AND (clinic_id_filter IS NULL OR kc."clinicId" IS NULL OR kc."clinicId" = clinic_id_filter)
    AND 1 - (kc."embedding" <=> query_embedding) > match_threshold
  ORDER BY kc."embedding" <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DONE! After running this migration:
-- 1. The KnowledgeChunks table is ready for document ingestion
-- 2. Full-text search works immediately (no embeddings needed)
-- 3. Vector search will work once embeddings are generated
-- =============================================================================
