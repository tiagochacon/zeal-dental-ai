import { describe, it, expect, vi, beforeEach } from "vitest";
import { chunkDocument } from "./ingestor";

// Mock supabase for retriever tests
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
          is: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
          })),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

describe("RAG Chunking", () => {
  it("should return single chunk for short content", () => {
    const content = "This is a short document.";
    const chunks = chunkDocument(content, { chunkSize: 1500 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(content);
  });

  it("should split long content into multiple chunks", () => {
    const content = "A".repeat(3000);
    const chunks = chunkDocument(content, { chunkSize: 1000, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("should respect chunk size limit", () => {
    const content = Array(20).fill("This is a paragraph of text that should be chunked properly.\n\n").join("");
    const chunks = chunkDocument(content, { chunkSize: 200, overlap: 50 });
    
    for (const chunk of chunks) {
      // Allow some tolerance (chunks can be slightly larger due to separator alignment)
      expect(chunk.length).toBeLessThanOrEqual(250);
    }
  });

  it("should prefer breaking at paragraph boundaries", () => {
    const content = "First paragraph content here.\n\nSecond paragraph content here.\n\nThird paragraph content here.";
    const chunks = chunkDocument(content, { chunkSize: 50, overlap: 10 });
    
    // Should break at \n\n boundaries
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).not.toContain("\n\nSecond");
  });

  it("should handle markdown headers as separators", () => {
    const content = `## Section One
Content of section one with enough text to fill a chunk.

## Section Two
Content of section two with enough text to fill another chunk.

## Section Three
Content of section three with enough text to fill yet another chunk.`;

    const chunks = chunkDocument(content, { chunkSize: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("should not produce empty chunks", () => {
    const content = "\n\n\n\nSome content\n\n\n\n";
    const chunks = chunkDocument(content, { chunkSize: 1500 });
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it("should handle content with only whitespace", () => {
    const content = "   ";
    const chunks = chunkDocument(content, { chunkSize: 1500 });
    expect(chunks).toHaveLength(0);
  });
});

describe("RAG Retriever", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should import retriever without errors", async () => {
    const { retrieveContext, formatContextForLLM } = await import("./retriever");
    expect(retrieveContext).toBeDefined();
    expect(formatContextForLLM).toBeDefined();
  });

  it("should format empty results as empty string", async () => {
    const { formatContextForLLM } = await import("./retriever");
    const result = formatContextForLLM({ chunks: [], totalFound: 0, method: "fts", queryTimeMs: 0 });
    expect(result).toBe("");
  });

  it("should format chunks with source attribution", async () => {
    const { formatContextForLLM } = await import("./retriever");
    const result = formatContextForLLM({
      chunks: [
        {
          id: 1,
          documentId: "test-doc",
          documentTitle: "Test Document",
          documentType: "methodology",
          category: "disc",
          content: "This is test content about DISC methodology.",
          metadata: {},
          score: 0.9,
        },
      ],
      totalFound: 1,
      method: "fts",
      queryTimeMs: 10,
    });

    expect(result).toContain("CONTEXTO DA BASE DE CONHECIMENTO");
    expect(result).toContain("Test Document");
    expect(result).toContain("disc");
    expect(result).toContain("This is test content");
  });

  it("should respect token budget when formatting", async () => {
    const { formatContextForLLM } = await import("./retriever");
    
    // Create chunks that exceed token budget
    const largeChunks = Array(10).fill(null).map((_, i) => ({
      id: i,
      documentId: `doc-${i}`,
      documentTitle: `Document ${i}`,
      documentType: "methodology",
      category: "disc",
      content: "X".repeat(2000), // Each chunk ~500 tokens
      metadata: {},
      score: 0.9 - i * 0.05,
    }));

    const result = formatContextForLLM({
      chunks: largeChunks,
      totalFound: 10,
      method: "fts",
      queryTimeMs: 10,
    });

    // Should not include all 10 chunks (would be ~5000 tokens, budget is 4000)
    const chunkCount = (result.match(/--- \[Document/g) || []).length;
    expect(chunkCount).toBeLessThan(10);
    expect(chunkCount).toBeGreaterThan(0);
  });
});

describe("RAG Ingestor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should import ingestor without errors", async () => {
    const { ingestDocument, deleteDocument } = await import("./ingestor");
    expect(ingestDocument).toBeDefined();
    expect(deleteDocument).toBeDefined();
  });
});
