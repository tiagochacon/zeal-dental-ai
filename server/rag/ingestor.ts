/**
 * RAG Ingestor — Document Chunking & Storage
 *
 * Handles the ingestion pipeline:
 * 1. Receives raw documents (markdown, text, PDF text)
 * 2. Splits into semantic chunks with overlap
 * 3. Stores in KnowledgeChunks table with metadata
 * 4. Auto-generates tsvector for full-text search
 *
 * Embedding generation is deferred (done separately when API is available).
 */
import { supabase } from "../lib/supabaseClient";
import { createLogger } from "../lib/logger";
import type { KnowledgeCategory } from "./retriever";

const log = createLogger("rag:ingestor");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface IngestDocumentInput {
  /** Unique identifier for the document (e.g., 'disc-methodology-v1') */
  documentId: string;
  /** Human-readable title */
  title: string;
  /** Document type classification */
  type: "methodology" | "protocol" | "guideline" | "faq";
  /** Knowledge category for filtering */
  category: KnowledgeCategory;
  /** Raw text content of the document */
  content: string;
  /** Optional clinic ID (null = global knowledge) */
  clinicId?: number | null;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  success: boolean;
  documentId: string;
  chunksCreated: number;
  version: number;
  error?: string;
}

export interface ChunkingOptions {
  /** Target chunk size in characters */
  chunkSize?: number;
  /** Overlap between consecutive chunks in characters */
  overlap?: number;
  /** Separator patterns to split on (in priority order) */
  separators?: string[];
}

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const DEFAULT_CHUNK_SIZE = 1500; // ~375 tokens
const DEFAULT_OVERLAP = 200; // ~50 tokens overlap
const DEFAULT_SEPARATORS = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "];

// --------------------------------------------------------------------------
// Chunking Algorithm
// --------------------------------------------------------------------------

/**
 * Split text into semantic chunks using recursive character splitting.
 * Respects paragraph/section boundaries when possible.
 */
export function chunkDocument(
  content: string,
  options: ChunkingOptions = {}
): string[] {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap = DEFAULT_OVERLAP,
    separators = DEFAULT_SEPARATORS,
  } = options;

  if (content.length <= chunkSize) {
    return [content.trim()].filter(Boolean);
  }

  const chunks: string[] = [];
  let currentPosition = 0;

  while (currentPosition < content.length) {
    let endPosition = Math.min(currentPosition + chunkSize, content.length);

    // If we're not at the end, try to find a good break point
    if (endPosition < content.length) {
      let bestBreak = -1;

      // Try each separator in priority order
      for (const sep of separators) {
        const searchStart = currentPosition + Math.floor(chunkSize * 0.5);
        const searchEnd = endPosition;
        const searchText = content.substring(searchStart, searchEnd);
        const lastIndex = searchText.lastIndexOf(sep);

        if (lastIndex !== -1) {
          bestBreak = searchStart + lastIndex + sep.length;
          break;
        }
      }

      if (bestBreak > currentPosition) {
        endPosition = bestBreak;
      }
    }

    const chunk = content.substring(currentPosition, endPosition).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move position forward, accounting for overlap
    const nextPosition = endPosition - overlap;
    if (nextPosition <= currentPosition) {
      currentPosition = endPosition; // Prevent infinite loop
    } else {
      currentPosition = nextPosition;
    }
  }

  return chunks;
}

// --------------------------------------------------------------------------
// Ingestion Pipeline
// --------------------------------------------------------------------------

/**
 * Ingest a document into the knowledge base.
 * Handles versioning: deactivates previous version, creates new chunks.
 */
export async function ingestDocument(input: IngestDocumentInput): Promise<IngestResult> {
  const { documentId, title, type, category, content, clinicId = null, metadata = {} } = input;

  log.info("Starting document ingestion", { documentId, title, contentLength: content.length });

  try {
    // 1. Get current version (if document already exists)
    const { data: existing } = await supabase
      .from("KnowledgeChunks")
      .select("version")
      .eq("documentId", documentId)
      .eq("isActive", true)
      .order("version", { ascending: false })
      .limit(1);

    const newVersion = existing && existing.length > 0 ? (existing[0].version || 1) + 1 : 1;

    // 2. Deactivate previous version
    if (newVersion > 1) {
      await supabase
        .from("KnowledgeChunks")
        .update({ isActive: false })
        .eq("documentId", documentId)
        .eq("isActive", true);

      log.info("Deactivated previous version", { documentId, previousVersion: newVersion - 1 });
    }

    // 3. Chunk the document
    const chunks = chunkDocument(content);

    // 4. Prepare rows for insertion
    const rows = chunks.map((chunkContent, index) => ({
      documentId,
      documentTitle: title,
      documentType: type,
      category,
      chunkIndex: index,
      content: chunkContent,
      contentTokens: Math.ceil(chunkContent.length / 4),
      clinicId,
      version: newVersion,
      isActive: true,
      metadata: {
        ...metadata,
        totalChunks: chunks.length,
        originalLength: content.length,
      },
    }));

    // 5. Insert chunks in batches of 50
    const BATCH_SIZE = 50;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("KnowledgeChunks").insert(batch);

      if (error) {
        log.error("Batch insert failed", { documentId, batchStart: i, error: error.message });
        return {
          success: false,
          documentId,
          chunksCreated: totalInserted,
          version: newVersion,
          error: `Batch insert failed at chunk ${i}: ${error.message}`,
        };
      }
      totalInserted += batch.length;
    }

    log.info("Document ingested successfully", {
      documentId,
      chunksCreated: totalInserted,
      version: newVersion,
    });

    return { success: true, documentId, chunksCreated: totalInserted, version: newVersion };
  } catch (err) {
    log.error("Ingestion failed", { documentId, error: String(err) });
    return {
      success: false,
      documentId,
      chunksCreated: 0,
      version: 0,
      error: String(err),
    };
  }
}

/**
 * Bulk ingest multiple documents.
 */
export async function ingestDocuments(documents: IngestDocumentInput[]): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const doc of documents) {
    const result = await ingestDocument(doc);
    results.push(result);
  }
  return results;
}

/**
 * Delete a document and all its chunks from the knowledge base.
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const { error } = await supabase
    .from("KnowledgeChunks")
    .delete()
    .eq("documentId", documentId);

  if (error) {
    log.error("Document deletion failed", { documentId, error: error.message });
    return false;
  }

  log.info("Document deleted", { documentId });
  return true;
}
