import { describe, expect, it } from "vitest";
import {
  buildTranscriptFromChunks,
  countErroredChunks,
  hasInFlightChunks,
  type ChunkTranscription,
} from "../client/src/hooks/useProgressiveAudioRecorder";

describe("progressive recorder transcript assembly", () => {
  it("keeps transcript ordered by chunkIndex", () => {
    const chunks: ChunkTranscription[] = [
      { index: 2, status: "done", text: "terceiro" },
      { index: 0, status: "done", text: "primeiro" },
      { index: 1, status: "done", text: "segundo" },
    ];

    expect(buildTranscriptFromChunks(chunks)).toBe("primeiro\n\nsegundo\n\nterceiro");
  });

  it("filters known hallucination markers from final transcript", () => {
    const chunks: ChunkTranscription[] = [
      { index: 0, status: "done", text: "Paciente relata sensibilidade ao frio." },
      {
        index: 1,
        status: "done",
        text: "Transcrição de consulta odontológica clínica. Português brasileiro.",
      },
    ];

    expect(buildTranscriptFromChunks(chunks)).toBe("Paciente relata sensibilidade ao frio.");
  });

  it("detects in-flight chunks so finalize cannot proceed silently", () => {
    const chunks: ChunkTranscription[] = [
      { index: 0, status: "done", text: "ok" },
      { index: 1, status: "transcribing", text: "" },
    ];

    expect(hasInFlightChunks(chunks)).toBe(true);
  });

  it("counts error chunks for explicit user warning", () => {
    const chunks: ChunkTranscription[] = [
      { index: 0, status: "done", text: "ok" },
      { index: 1, status: "error", text: "", error: "timeout" },
      { index: 2, status: "error", text: "", error: "whisper" },
    ];

    expect(countErroredChunks(chunks)).toBe(2);
  });
});
