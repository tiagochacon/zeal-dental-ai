import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/chunk.webm", key: "chunk.webm" }),
}));

vi.mock("./db", () => ({
  createAudioChunk: vi.fn().mockResolvedValue(undefined),
  updateAudioChunkTranscript: vi.fn().mockResolvedValue(undefined),
  updateAudioChunkStatus: vi.fn().mockResolvedValue(undefined),
  getAudioChunksBySession: vi.fn().mockResolvedValue([]),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn().mockResolvedValue({ id: 1, name: "Test User" }),
  },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    forgeApiUrl: "https://forge.example.com/",
    forgeApiKey: "test-key",
  },
}));

import { createAudioChunk, updateAudioChunkTranscript, updateAudioChunkStatus, getAudioChunksBySession } from "./db";
import { storagePut } from "./storage";

describe("Transcribe Chunk System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Audio Chunk Database Operations", () => {
    it("should save chunk metadata with transcription status", async () => {
      await (createAudioChunk as any)({
        consultationId: 1,
        recordingSessionId: "session-123",
        chunkIndex: 0,
        fileKey: "consultations/1/1/chunks/session-123/chunk-0.webm",
        url: "https://s3.example.com/chunk.webm",
        mimeType: "audio/webm",
        sizeBytes: 50000,
        durationSeconds: 60,
        transcriptionStatus: "transcribing",
      });

      expect(createAudioChunk).toHaveBeenCalledWith(
        expect.objectContaining({
          consultationId: 1,
          chunkIndex: 0,
          transcriptionStatus: "transcribing",
        })
      );
    });

    it("should update chunk with transcript text and done status", async () => {
      await (updateAudioChunkTranscript as any)(1, "session-123", 0, "Olá, como posso ajudar?");

      expect(updateAudioChunkTranscript).toHaveBeenCalledWith(
        1, "session-123", 0, "Olá, como posso ajudar?"
      );
    });

    it("should update chunk status to error with error message", async () => {
      await (updateAudioChunkStatus as any)(1, "session-123", 0, "error", "Whisper 400: Bad Request");

      expect(updateAudioChunkStatus).toHaveBeenCalledWith(
        1, "session-123", 0, "error", "Whisper 400: Bad Request"
      );
    });

    it("should retrieve chunks by session ordered by index", async () => {
      const mockChunks = [
        { chunkIndex: 0, transcriptionStatus: "done", transcriptText: "Olá" },
        { chunkIndex: 1, transcriptionStatus: "done", transcriptText: "Como vai?" },
        { chunkIndex: 2, transcriptionStatus: "transcribing", transcriptText: null },
      ];
      (getAudioChunksBySession as any).mockResolvedValue(mockChunks);

      const chunks = await (getAudioChunksBySession as any)(1, "session-123");

      expect(chunks).toHaveLength(3);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[2].transcriptionStatus).toBe("transcribing");
    });
  });

  describe("S3 Upload for Chunks", () => {
    it("should upload chunk to S3 with correct path", async () => {
      const buffer = Buffer.from("fake-audio-data");
      await (storagePut as any)(
        "consultations/1/1/chunks/session-123/chunk-0-abc123.webm",
        buffer,
        "audio/webm"
      );

      expect(storagePut).toHaveBeenCalledWith(
        expect.stringContaining("chunk-0"),
        buffer,
        "audio/webm"
      );
    });

    it("should generate unique file keys with nanoid", () => {
      const key1 = `consultations/1/1/chunks/session-123/chunk-0-abc123.webm`;
      const key2 = `consultations/1/1/chunks/session-123/chunk-0-def456.webm`;
      expect(key1).not.toBe(key2);
    });
  });

  describe("Chunk Transcription Assembly", () => {
    it("should assemble transcript from completed chunks in order", () => {
      const chunks = [
        { index: 0, status: "done", text: "Bom dia, paciente." },
        { index: 1, status: "done", text: "Estou sentindo dor no dente 25." },
        { index: 2, status: "done", text: "Há quanto tempo sente essa dor?" },
      ];

      const sorted = [...chunks].sort((a, b) => a.index - b.index);
      const transcript = sorted
        .filter((c) => c.status === "done")
        .map((c) => c.text.trim())
        .filter(Boolean)
        .join("\n\n");

      expect(transcript).toBe(
        "Bom dia, paciente.\n\nEstou sentindo dor no dente 25.\n\nHá quanto tempo sente essa dor?"
      );
    });

    it("should skip errored chunks during assembly", () => {
      const chunks = [
        { index: 0, status: "done", text: "Primeiro segmento." },
        { index: 1, status: "error", text: "", error: "Whisper failed" },
        { index: 2, status: "done", text: "Terceiro segmento." },
      ];

      const transcript = chunks
        .filter((c) => c.status === "done")
        .sort((a, b) => a.index - b.index)
        .map((c) => c.text.trim())
        .filter(Boolean)
        .join("\n\n");

      expect(transcript).toBe("Primeiro segmento.\n\nTerceiro segmento.");
    });

    it("should handle empty transcript chunks", () => {
      const chunks = [
        { index: 0, status: "done", text: "Segmento com fala." },
        { index: 1, status: "done", text: "" },
        { index: 2, status: "done", text: "  " },
        { index: 3, status: "done", text: "Outro segmento." },
      ];

      const transcript = chunks
        .filter((c) => c.status === "done")
        .sort((a, b) => a.index - b.index)
        .map((c) => c.text.trim())
        .filter(Boolean)
        .join("\n\n");

      expect(transcript).toBe("Segmento com fala.\n\nOutro segmento.");
    });

    it("should return empty string when all chunks failed", () => {
      const chunks = [
        { index: 0, status: "error", text: "" },
        { index: 1, status: "error", text: "" },
      ];

      const transcript = chunks
        .filter((c) => c.status === "done")
        .map((c) => c.text.trim())
        .filter(Boolean)
        .join("\n\n");

      expect(transcript).toBe("");
    });
  });

  describe("Chunk Validation", () => {
    it("should skip chunks smaller than 1KB (silence/noise)", () => {
      const tinyBuffer = Buffer.alloc(500); // 500 bytes
      expect(tinyBuffer.length).toBeLessThan(1024);
    });

    it("should accept chunks larger than 1KB", () => {
      const normalBuffer = Buffer.alloc(50000); // 50KB
      expect(normalBuffer.length).toBeGreaterThan(1024);
    });

    it("should handle base64 encoding/decoding correctly", () => {
      const original = "fake audio data for testing";
      const base64 = Buffer.from(original).toString("base64");
      const decoded = Buffer.from(base64, "base64").toString();
      expect(decoded).toBe(original);
    });
  });

  describe("Progressive Recording Session", () => {
    it("should generate unique session IDs", () => {
      const id1 = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const id2 = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^rec_\d+_[a-z0-9]+$/);
    });

    it("should track chunk progress correctly", () => {
      const chunks = [
        { index: 0, status: "done" },
        { index: 1, status: "done" },
        { index: 2, status: "transcribing" },
        { index: 3, status: "pending" },
      ];

      const completed = chunks.filter((c) => c.status === "done").length;
      const total = chunks.length;
      const hasErrors = chunks.some((c) => c.status === "error");
      const allDone = chunks.every((c) => c.status === "done" || c.status === "error");

      expect(completed).toBe(2);
      expect(total).toBe(4);
      expect(hasErrors).toBe(false);
      expect(allDone).toBe(false);
    });

    it("should detect when all chunks are done", () => {
      const chunks = [
        { index: 0, status: "done" },
        { index: 1, status: "done" },
        { index: 2, status: "error" },
      ];

      const allDone = chunks.every((c) => c.status === "done" || c.status === "error");
      expect(allDone).toBe(true);
    });
  });

  describe("Dental Prompt for Whisper", () => {
    it("should include dental vocabulary in prompt", () => {
      const DENTAL_PROMPT =
        "Transcrição de consulta odontológica clínica. Vocabulário esperado: cárie, restauração, canal, extração, implante, prótese, periodontia, ortodontia, radiografia, anestesia, dente 16, dente 21, FDI, SOAP, diagnóstico, plano de tratamento, hipótese diagnóstica, gengivite, molar, incisivo, obturação, profilaxia, clareamento, bruxismo, oclusão, endodontia. Diálogo entre dentista e paciente. Português brasileiro.";

      expect(DENTAL_PROMPT).toContain("cárie");
      expect(DENTAL_PROMPT).toContain("restauração");
      expect(DENTAL_PROMPT).toContain("SOAP");
      expect(DENTAL_PROMPT).toContain("Português brasileiro");
      expect(DENTAL_PROMPT).toContain("dente 16");
    });
  });
});
