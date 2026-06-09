/**
 * RAG Retriever — Knowledge Base Search
 *
 * Provides context retrieval for LLM calls using:
 * 1. Full-text search (PostgreSQL tsvector) — primary, always available
 * 2. Vector similarity search (pgvector) — future, when embeddings are available
 *
 * The retriever is called before every LLM invocation that needs grounding
 * (SOAP, neurovendas, treatment plans) to inject relevant methodology context.
 */
import { supabase } from "../lib/supabaseClient";
import { createLogger } from "../lib/logger";

const log = createLogger("rag:retriever");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface RetrievalOptions {
  /** The query text to search for */
  query: string;
  /** Filter by knowledge category */
  category?: KnowledgeCategory | null;
  /** Filter by clinic (null = global only, number = global + clinic-specific) */
  clinicId?: number | null;
  /** Maximum number of chunks to return */
  maxResults?: number;
  /** Minimum relevance score (0-1) */
  minScore?: number;
}

export interface RetrievedChunk {
  id: number;
  documentId: string;
  documentTitle: string;
  documentType: string;
  category: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  totalFound: number;
  method: "fts" | "vector" | "fallback";
  queryTimeMs: number;
}

export type KnowledgeCategory =
  | "disc"
  | "neurovendas"
  | "rapport"
  | "objection_handling"
  | "clinical"
  | "communication"
  | "soap"
  | "treatment_plan";

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MIN_SCORE = 0.1;
const MAX_CONTEXT_TOKENS = 4000; // Approximate token budget for RAG context

// --------------------------------------------------------------------------
// Full-Text Search (Primary Method)
// --------------------------------------------------------------------------

async function searchByFullText(options: RetrievalOptions): Promise<RetrievalResult> {
  const {
    query,
    category = null,
    clinicId = null,
    maxResults = DEFAULT_MAX_RESULTS,
  } = options;

  const startTime = Date.now();

  try {
    const { data, error } = await supabase.rpc("search_knowledge_chunks", {
      query_text: query,
      category_filter: category,
      clinic_id_filter: clinicId,
      max_results: maxResults,
    });

    if (error) {
      log.error("Full-text search RPC failed", { error: error.message, query: query.substring(0, 50) });
      return { chunks: [], totalFound: 0, method: "fts", queryTimeMs: Date.now() - startTime };
    }

    const chunks: RetrievedChunk[] = (data || []).map((row: any) => ({
      id: row.id,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      documentType: row.documentType,
      category: row.category,
      content: row.content,
      metadata: row.metadata || {},
      score: row.rank || 0,
    }));

    return {
      chunks,
      totalFound: chunks.length,
      method: "fts",
      queryTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    log.error("Full-text search exception", { error: String(err) });
    return { chunks: [], totalFound: 0, method: "fts", queryTimeMs: Date.now() - startTime };
  }
}

// --------------------------------------------------------------------------
// Vector Similarity Search (Future — when embeddings are available)
// --------------------------------------------------------------------------

async function searchByVector(
  queryEmbedding: number[],
  options: RetrievalOptions
): Promise<RetrievalResult> {
  const {
    category = null,
    clinicId = null,
    maxResults = DEFAULT_MAX_RESULTS,
    minScore = DEFAULT_MIN_SCORE,
  } = options;

  const startTime = Date.now();

  try {
    const { data, error } = await supabase.rpc("match_knowledge_chunks", {
      query_embedding: queryEmbedding,
      category_filter: category,
      clinic_id_filter: clinicId,
      match_threshold: minScore,
      match_count: maxResults,
    });

    if (error) {
      log.error("Vector search RPC failed", { error: error.message });
      return { chunks: [], totalFound: 0, method: "vector", queryTimeMs: Date.now() - startTime };
    }

    const chunks: RetrievedChunk[] = (data || []).map((row: any) => ({
      id: row.id,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      documentType: row.documentType,
      category: row.category,
      content: row.content,
      metadata: row.metadata || {},
      score: row.similarity || 0,
    }));

    return {
      chunks,
      totalFound: chunks.length,
      method: "vector",
      queryTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    log.error("Vector search exception", { error: String(err) });
    return { chunks: [], totalFound: 0, method: "vector", queryTimeMs: Date.now() - startTime };
  }
}

// --------------------------------------------------------------------------
// Fallback: Load all chunks by category (when FTS returns nothing)
// --------------------------------------------------------------------------

async function loadByCategory(category: KnowledgeCategory, clinicId?: number | null): Promise<RetrievalResult> {
  const startTime = Date.now();

  try {
    let query = supabase
      .from("KnowledgeChunks")
      .select("*")
      .eq("isActive", true)
      .eq("category", category)
      .order("chunkIndex", { ascending: true })
      .limit(10);

    if (clinicId) {
      query = query.or(`clinicId.is.null,clinicId.eq.${clinicId}`);
    } else {
      query = query.is("clinicId", null);
    }

    const { data, error } = await query;

    if (error) {
      log.warn("Category fallback query failed", { error: error.message, category });
      return { chunks: [], totalFound: 0, method: "fallback", queryTimeMs: Date.now() - startTime };
    }

    const chunks: RetrievedChunk[] = (data || []).map((row: any) => ({
      id: row.id,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      documentType: row.documentType,
      category: row.category,
      content: row.content,
      metadata: row.metadata || {},
      score: 0.5, // Default score for category-based retrieval
    }));

    return {
      chunks,
      totalFound: chunks.length,
      method: "fallback",
      queryTimeMs: Date.now() - startTime,
    };
  } catch (err) {
    log.error("Category fallback exception", { error: String(err) });
    return { chunks: [], totalFound: 0, method: "fallback", queryTimeMs: Date.now() - startTime };
  }
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Retrieve relevant knowledge chunks for a given query.
 * Uses full-text search as primary method, falls back to category loading.
 */
export async function retrieveContext(options: RetrievalOptions): Promise<RetrievalResult> {
  // Try full-text search first
  const ftsResult = await searchByFullText(options);

  if (ftsResult.chunks.length > 0) {
    log.info("Context retrieved via FTS", {
      query: options.query.substring(0, 50),
      category: options.category,
      chunksFound: ftsResult.chunks.length,
      timeMs: ftsResult.queryTimeMs,
    });
    return ftsResult;
  }

  // Fallback: load by category if FTS found nothing
  if (options.category) {
    const fallbackResult = await loadByCategory(options.category, options.clinicId);
    if (fallbackResult.chunks.length > 0) {
      log.info("Context retrieved via category fallback", {
        category: options.category,
        chunksFound: fallbackResult.chunks.length,
        timeMs: fallbackResult.queryTimeMs,
      });
      return fallbackResult;
    }
  }

  log.warn("No context found for query", {
    query: options.query.substring(0, 50),
    category: options.category,
  });

  return { chunks: [], totalFound: 0, method: "fts", queryTimeMs: 0 };
}

/**
 * Format retrieved chunks into a context string for LLM injection.
 * Respects token budget and adds source attribution.
 */
export function formatContextForLLM(result: RetrievalResult): string {
  if (result.chunks.length === 0) {
    return "";
  }

  let totalTokens = 0;
  const formattedChunks: string[] = [];

  for (const chunk of result.chunks) {
    const estimatedTokens = Math.ceil(chunk.content.length / 4); // ~4 chars per token
    if (totalTokens + estimatedTokens > MAX_CONTEXT_TOKENS) break;

    formattedChunks.push(
      `--- [${chunk.documentTitle}] (${chunk.category}) ---\n${chunk.content}`
    );
    totalTokens += estimatedTokens;
  }

  return `CONTEXTO DA BASE DE CONHECIMENTO (${result.method.toUpperCase()}, ${result.chunks.length} trechos):\n\n${formattedChunks.join("\n\n")}`;
}

/**
 * Retrieve and format context in one call — convenience wrapper.
 */
export async function getRAGContext(options: RetrievalOptions): Promise<string> {
  const result = await retrieveContext(options);
  return formatContextForLLM(result);
}
