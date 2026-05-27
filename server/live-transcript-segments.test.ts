import { describe, expect, it } from "vitest";
import {
  collapsePrefixDuplicateSegments,
  mergeFinalSegment,
} from "@shared/liveTranscriptSegments";

describe("collapsePrefixDuplicateSegments", () => {
  it("collapses cumulative prefix chain into longest segment", () => {
    const input = [
      { text: "E", turnId: "turn_1" },
      { text: "E aí", turnId: "turn_1" },
      { text: "E aí eu", turnId: "turn_1" },
      { text: "E aí eu já posso parar.", turnId: "turn_1" },
    ];

    const result = collapsePrefixDuplicateSegments(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("E aí eu já posso parar.");
  });

  it("keeps distinct sentences that are not prefix extensions", () => {
    const input = [
      { text: "Olá, tudo bem?", turnId: "turn_1" },
      { text: "Vamos começar a consulta.", turnId: "turn_2" },
    ];

    const result = collapsePrefixDuplicateSegments(input);
    expect(result).toHaveLength(2);
  });
});

describe("mergeFinalSegment", () => {
  const base = {
    speakerLabel: null as string | null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("replaces last segment when same turnId", () => {
    const prev = [{ ...base, turnId: "turn_1", text: "E aí eu" }];
    const next = { ...base, turnId: "turn_1", text: "E aí eu já posso parar." };

    const result = mergeFinalSegment(prev, next);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("E aí eu já posso parar.");
  });

  it("simulates 5 prefix finals + 1 true final => single segment", () => {
    let segments: Array<{ turnId: string; text: string; speakerLabel: null; createdAt: string }> = [];
    const partials = ["E", "E aí", "E aí eu", "E aí eu já", "E aí eu já posso"];
    for (const text of partials) {
      segments = mergeFinalSegment(segments, {
        ...base,
        turnId: "turn_1",
        text,
        createdAt: "2026-01-01T00:00:01.000Z",
      });
    }
    segments = mergeFinalSegment(segments, {
      ...base,
      turnId: "turn_1",
      text: "E aí eu já posso parar.",
      createdAt: "2026-01-01T00:00:02.000Z",
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]?.text).toBe("E aí eu já posso parar.");
  });
});
