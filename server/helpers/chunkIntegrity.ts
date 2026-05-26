type ChunkLike = {
  chunkIndex: number;
  transcriptionStatus: string | null;
  transcriptText?: string | null;
  transcriptionError?: string | null;
};

export type ChunkIntegritySummary = {
  totalChunksReceived: number;
  totalChunksProcessed: number;
  totalChunksErrored: number;
  finalChunkIndex: number | null;
  finalChunkProcessed: boolean;
  mismatchDetected: boolean;
  expectedTotalChunks: number | null;
};

export function summarizeChunkIntegrity(
  chunks: ChunkLike[],
  expectedTotalChunks?: number
): ChunkIntegritySummary {
  const totalChunksReceived = chunks.length;
  const totalChunksProcessed = chunks.filter(
    (chunk) => chunk.transcriptionStatus === "done"
  ).length;
  const totalChunksErrored = chunks.filter(
    (chunk) => chunk.transcriptionStatus === "error"
  ).length;
  const finalChunkIndex =
    chunks.length > 0 ? Math.max(...chunks.map((chunk) => chunk.chunkIndex)) : null;
  const finalChunkProcessed =
    finalChunkIndex === null
      ? false
      : chunks.some(
          (chunk) =>
            chunk.chunkIndex === finalChunkIndex &&
            (chunk.transcriptionStatus === "done" ||
              chunk.transcriptionStatus === "error")
        );
  const expected = typeof expectedTotalChunks === "number" ? expectedTotalChunks : null;
  const expectedMismatch =
    expected !== null ? totalChunksReceived !== expected : false;
  const mismatchDetected = expectedMismatch || !finalChunkProcessed;

  return {
    totalChunksReceived,
    totalChunksProcessed,
    totalChunksErrored,
    finalChunkIndex,
    finalChunkProcessed,
    mismatchDetected,
    expectedTotalChunks: expected,
  };
}
