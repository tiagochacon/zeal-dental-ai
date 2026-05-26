import { describe, expect, it } from "vitest";
import { postProcessTranscript } from "./ai/stt/postProcessTranscript";
import type { TranscribeResult } from "./ai/stt";

describe("postProcessTranscript", () => {
  it("marks uncertain and low confidence segments conservatively", () => {
    const input: TranscribeResult = {
      transcript: "texto bruto",
      provider: "whisper",
      model: "whisper-1",
      fallbackUsed: false,
      warnings: [],
      segments: [
        {
          id: "s1",
          speakerLabel: null,
          speakerRole: "UNKNOWN",
          start: 0,
          end: 2,
          text: "fala com boa confiança",
          confidence: 0.9,
          flagged: false,
        },
        {
          id: "s2",
          speakerLabel: null,
          speakerRole: "UNKNOWN",
          start: 2,
          end: 4,
          text: "fala duvidosa",
          confidence: 0.6,
          flagged: true,
        },
        {
          id: "s3",
          speakerLabel: null,
          speakerRole: "UNKNOWN",
          start: 4,
          end: 6,
          text: "quase inaudível",
          confidence: 0.4,
          flagged: true,
        },
      ],
    };

    const output = postProcessTranscript(input);
    expect(output.processedTranscript).toContain("[INCERTO:");
    expect(output.processedTranscript).toContain("[BAIXA_CONFIANCA:");
    expect(output.uncertainSegmentIds).toEqual(["s2", "s3"]);
    expect(output.warnings.some((warning) => warning.includes("baixa confiança"))).toBe(true);
  });
});
