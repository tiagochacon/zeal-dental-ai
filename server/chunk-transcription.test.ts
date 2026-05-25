import { describe, expect, it } from "vitest";
import {
  buildConservativeChunkPrompt,
  detectChunkHallucination,
  isRecoverableWhisperChunkError,
  resolveAudioExtensionForMimeType,
} from "./helpers/chunkTranscription";

describe("chunk transcription helpers", () => {
  it("resolve extension from mime type safely", () => {
    expect(resolveAudioExtensionForMimeType("audio/webm;codecs=opus")).toBe("webm");
    expect(resolveAudioExtensionForMimeType("audio/mp4")).toBe("mp4");
    expect(resolveAudioExtensionForMimeType("audio/mpeg")).toBe("mp3");
    expect(resolveAudioExtensionForMimeType("audio/wav")).toBe("wav");
  });

  it("build conservative prompt with explicit context rule", () => {
    const prompt = buildConservativeChunkPrompt("paciente relata dor no dente");
    expect(prompt).toContain("apenas para continuidade");
    expect(prompt).toContain("não retranscreva literalmente");
    expect(prompt).toContain("Não invente");
  });

  it("detects hallucination for silent chunk", () => {
    const result = detectChunkHallucination("texto inventado", [
      { no_speech_prob: 0.96, avg_logprob: -0.4 },
    ]);
    expect(result.isHallucination).toBe(true);
    expect(result.reason).toContain("silêncio");
  });

  it("detects known prompt/marker leakage", () => {
    const result = detectChunkHallucination(
      "Transcrição de consulta odontológica clínica. Obrigado por assistir.",
      []
    );
    expect(result.isHallucination).toBe(true);
  });

  it("classifies recoverable final-chunk whisper errors", () => {
    expect(
      isRecoverableWhisperChunkError(400, "Invalid file format: could not be decoded")
    ).toBe(true);
    expect(
      isRecoverableWhisperChunkError(422, "unprocessable entity", 5)
    ).toBe(true);
    expect(
      isRecoverableWhisperChunkError(500, "upstream timeout", 5)
    ).toBe(false);
  });
});
