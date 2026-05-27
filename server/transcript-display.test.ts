import { describe, expect, it } from "vitest";
import { stripUncertaintyMarkers } from "@shared/transcriptDisplay";
import { shouldUseBatchFallback } from "@shared/liveTranscriptFallback";

describe("stripUncertaintyMarkers", () => {
  it("removes INCERTO and BAIXA_CONFIANCA wrappers from legacy transcripts", () => {
    const raw =
      '[INCERTO: "Alô?"]\n\n[INCERTO: "Alô, Guilherme, eu sou o Helio Corti."]';
    expect(stripUncertaintyMarkers(raw)).toBe(
      "Alô?\n\nAlô, Guilherme, eu sou o Helio Corti."
    );
  });

  it("removes BAIXA_CONFIANCA markers", () => {
    expect(stripUncertaintyMarkers('[BAIXA_CONFIANCA: "teste"]')).toBe("teste");
  });
});

describe("shouldUseBatchFallback", () => {
  it("does not fallback when live transcript is useful even with explicit failure flag", () => {
    const longTranscript = "a".repeat(120);
    expect(shouldUseBatchFallback(longTranscript, 3, true)).toBe(false);
  });

  it("fallbacks when transcript is empty", () => {
    expect(shouldUseBatchFallback("", 0, false)).toBe(true);
  });

  it("fallbacks when transcript is too short and explicit failure occurred", () => {
    expect(shouldUseBatchFallback("oi", 1, true)).toBe(true);
  });
});
