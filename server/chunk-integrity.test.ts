import { describe, expect, it } from "vitest";
import { summarizeChunkIntegrity } from "./helpers/chunkIntegrity";

describe("chunk integrity summary", () => {
  it("detects mismatch when final chunk not processed", () => {
    const integrity = summarizeChunkIntegrity(
      [
        { chunkIndex: 0, transcriptionStatus: "done" },
        { chunkIndex: 1, transcriptionStatus: "transcribing" },
      ],
      2
    );
    expect(integrity.finalChunkProcessed).toBe(false);
    expect(integrity.mismatchDetected).toBe(true);
  });

  it("passes when expected chunks are processed", () => {
    const integrity = summarizeChunkIntegrity(
      [
        { chunkIndex: 0, transcriptionStatus: "done" },
        { chunkIndex: 1, transcriptionStatus: "done" },
      ],
      2
    );
    expect(integrity.finalChunkProcessed).toBe(true);
    expect(integrity.mismatchDetected).toBe(false);
  });
});
