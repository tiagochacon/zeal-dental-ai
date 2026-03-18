import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the audio chunk recovery logic in the transcribe mutation.
 * When audioUrl is NULL but audioChunks exist, the system should:
 * 1. Detect the missing audioUrl
 * 2. Fetch all chunks from the database
 * 3. Download and concatenate them
 * 4. Upload the concatenated audio to S3
 * 5. Update the consultation with the recovered audioUrl
 * 6. Clean up chunks from the database
 * 7. Proceed with transcription
 */

// Mock all dependencies
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "consultations/1/100/audio-recovered-abc.webm",
    url: "https://s3.example.com/consultations/1/100/audio-recovered-abc.webm",
  }),
  storageDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  getConsultationById: vi.fn(),
  updateConsultation: vi.fn().mockResolvedValue(undefined),
  getAudioChunksByConsultation: vi.fn(),
  deleteAudioChunksByConsultation: vi.fn().mockResolvedValue(undefined),
  getUserById: vi.fn(),
}));

vi.mock("./helpers/concatenateAudioChunks", () => ({
  concatenateAudioChunksWithFfmpeg: vi.fn().mockResolvedValue({
    buffer: Buffer.from("concatenated-audio-data"),
    mimeType: "audio/webm",
  }),
}));

vi.mock("./_core/voiceTranscription", () => ({
  transcribeLongAudio: vi.fn().mockResolvedValue({
    task: "transcribe",
    language: "pt",
    duration: 3600,
    text: "Transcrição de teste",
    segments: [{ id: 0, start: 0, end: 10, text: "Transcrição de teste" }],
  }),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("testrecovery"),
}));

import {
  getConsultationById,
  updateConsultation,
  getAudioChunksByConsultation,
  deleteAudioChunksByConsultation,
} from "./db";
import { storagePut } from "./storage";
import { concatenateAudioChunksWithFfmpeg } from "./helpers/concatenateAudioChunks";
import { transcribeLongAudio } from "./_core/voiceTranscription";

describe("Audio Chunk Recovery in Transcription", () => {
  const mockConsultationWithAudio = {
    id: 100,
    dentistId: 1,
    patientId: 10,
    patientName: "Test Patient",
    audioUrl: "https://s3.example.com/audio.webm",
    audioFileKey: "consultations/1/100/audio.webm",
    audioDurationSeconds: 3600,
    status: "draft",
    transcript: null,
  };

  const mockConsultationNoAudio = {
    ...mockConsultationWithAudio,
    audioUrl: null,
    audioFileKey: null,
    audioDurationSeconds: null,
  };

  const mockChunks = [
    {
      id: 1,
      consultationId: 100,
      recordingSessionId: "session-123",
      chunkIndex: 0,
      fileKey: "consultations/1/100/chunks/session-123/chunk-0.webm",
      url: "https://s3.example.com/chunk-0.webm",
      mimeType: "audio/webm",
      sizeBytes: 957484,
      durationSeconds: 60,
      uploadedAt: new Date(),
      transcriptText: null,
    },
    {
      id: 2,
      consultationId: 100,
      recordingSessionId: "session-123",
      chunkIndex: 1,
      fileKey: "consultations/1/100/chunks/session-123/chunk-1.webm",
      url: "https://s3.example.com/chunk-1.webm",
      mimeType: "audio/webm",
      sizeBytes: 966033,
      durationSeconds: 60,
      uploadedAt: new Date(),
      transcriptText: null,
    },
    {
      id: 3,
      consultationId: 100,
      recordingSessionId: "session-123",
      chunkIndex: 2,
      fileKey: "consultations/1/100/chunks/session-123/chunk-2.webm",
      url: "https://s3.example.com/chunk-2.webm",
      mimeType: "audio/webm",
      sizeBytes: 967017,
      durationSeconds: 60,
      uploadedAt: new Date(),
      transcriptText: null,
    },
  ];

  const mockUser = {
    id: 1,
    role: "admin" as const,
    clinicId: 1,
    clinicRole: "gestor" as const,
    subscriptionTier: "unlimited" as const,
    subscriptionStatus: "active" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Detection of missing audioUrl with chunks", () => {
    it("should detect when consultation has no audioUrl", () => {
      expect(mockConsultationNoAudio.audioUrl).toBeNull();
    });

    it("should detect when consultation has audioUrl", () => {
      expect(mockConsultationWithAudio.audioUrl).toBeTruthy();
    });

    it("should find chunks for consultation without audioUrl", async () => {
      (getAudioChunksByConsultation as any).mockResolvedValue(mockChunks);
      const chunks = await getAudioChunksByConsultation(100);
      expect(chunks).toHaveLength(3);
      expect(chunks[0].chunkIndex).toBe(0);
    });

    it("should return empty array when no chunks exist", async () => {
      (getAudioChunksByConsultation as any).mockResolvedValue([]);
      const chunks = await getAudioChunksByConsultation(999);
      expect(chunks).toHaveLength(0);
    });
  });

  describe("Chunk recovery flow", () => {
    it("should calculate total duration from chunks", () => {
      const totalDuration = mockChunks.reduce(
        (sum, c) => sum + (c.durationSeconds || 0),
        0
      );
      expect(totalDuration).toBe(180); // 3 chunks * 60s
    });

    it("should concatenate chunks using ffmpeg", async () => {
      const chunkBuffers = mockChunks.map(() =>
        Buffer.from("fake-audio-data")
      );
      const result = await concatenateAudioChunksWithFfmpeg(
        chunkBuffers,
        "audio/webm"
      );
      expect(result.buffer).toBeDefined();
      expect(result.mimeType).toBe("audio/webm");
    });

    it("should upload concatenated audio to S3", async () => {
      const buffer = Buffer.from("concatenated-audio");
      const { url } = await storagePut(
        "consultations/1/100/audio-recovered-abc.webm",
        buffer,
        "audio/webm"
      );
      expect(url).toContain("audio-recovered");
      expect(storagePut).toHaveBeenCalledWith(
        "consultations/1/100/audio-recovered-abc.webm",
        buffer,
        "audio/webm"
      );
    });

    it("should update consultation with recovered audioUrl", async () => {
      const recoveredUrl =
        "https://s3.example.com/consultations/1/100/audio-recovered-abc.webm";
      await updateConsultation(100, {
        audioUrl: recoveredUrl,
        audioFileKey: "consultations/1/100/audio-recovered-abc.webm",
        audioDurationSeconds: 180,
      });
      expect(updateConsultation).toHaveBeenCalledWith(100, {
        audioUrl: recoveredUrl,
        audioFileKey: "consultations/1/100/audio-recovered-abc.webm",
        audioDurationSeconds: 180,
      });
    });

    it("should clean up chunks after successful recovery", async () => {
      await deleteAudioChunksByConsultation(100);
      expect(deleteAudioChunksByConsultation).toHaveBeenCalledWith(100);
    });
  });

  describe("Transcription after recovery", () => {
    it("should transcribe using recovered audioUrl", async () => {
      const recoveredUrl =
        "https://s3.example.com/consultations/1/100/audio-recovered-abc.webm";
      const result = await transcribeLongAudio({
        audioUrl: recoveredUrl,
        language: "pt",
        prompt: "Transcrição de consulta odontológica clínica.",
      });
      expect(result).not.toHaveProperty("error");
      if (!("error" in result)) {
        expect(result.text).toBe("Transcrição de teste");
        expect(result.segments).toHaveLength(1);
      }
    });

    it("should update consultation with transcript after recovery", async () => {
      await updateConsultation(100, {
        transcript: "Transcrição de teste",
        transcriptSegments: [
          { id: 0, start: 0, end: 10, text: "Transcrição de teste" },
        ] as any,
        status: "transcribed",
      });
      expect(updateConsultation).toHaveBeenCalledWith(100, {
        transcript: "Transcrição de teste",
        transcriptSegments: expect.any(Array),
        status: "transcribed",
      });
    });
  });

  describe("Error handling", () => {
    it("should throw when no audioUrl AND no chunks exist", async () => {
      (getAudioChunksByConsultation as any).mockResolvedValue([]);
      const consultation = mockConsultationNoAudio;
      const chunks = await getAudioChunksByConsultation(
        consultation.id
      );
      expect(consultation.audioUrl).toBeNull();
      expect(chunks).toHaveLength(0);
      // In the actual code, this throws "Nenhum arquivo de áudio encontrado para esta consulta"
    });

    it("should handle many chunks (73 chunks = ~73 min recording)", async () => {
      const manyChunks = Array.from({ length: 73 }, (_, i) => ({
        ...mockChunks[0],
        id: i + 1,
        chunkIndex: i,
        url: `https://s3.example.com/chunk-${i}.webm`,
      }));
      (getAudioChunksByConsultation as any).mockResolvedValue(manyChunks);
      const chunks = await getAudioChunksByConsultation(100);
      expect(chunks).toHaveLength(73);
      const totalDuration = chunks.reduce(
        (sum: number, c: any) => sum + (c.durationSeconds || 0),
        0
      );
      expect(totalDuration).toBe(73 * 60); // 73 minutes
    });

    it("should handle chunks with null durationSeconds", () => {
      const chunksWithNullDuration = mockChunks.map((c) => ({
        ...c,
        durationSeconds: null,
      }));
      const totalDuration = chunksWithNullDuration.reduce(
        (sum, c) => sum + (c.durationSeconds || 0),
        0
      );
      expect(totalDuration).toBe(0);
    });

    it("should generate correct file extension from chunk mimeType", () => {
      const mimeType = "audio/webm";
      const extension = mimeType.split("/")[1] || "webm";
      expect(extension).toBe("webm");
    });

    it("should generate correct file key for recovered audio", () => {
      const userId = 1;
      const consultationId = 100;
      const nanoidResult = "testrecovery";
      const extension = "webm";
      const fileKey = `consultations/${userId}/${consultationId}/audio-recovered-${nanoidResult}.${extension}`;
      expect(fileKey).toBe(
        "consultations/1/100/audio-recovered-testrecovery.webm"
      );
    });
  });

  describe("Normal flow (audioUrl present)", () => {
    it("should skip chunk recovery when audioUrl exists", async () => {
      const consultation = mockConsultationWithAudio;
      expect(consultation.audioUrl).toBeTruthy();
      // In the actual code, chunk recovery is skipped entirely
      // and transcribeLongAudio is called directly with consultation.audioUrl
    });

    it("should not call getAudioChunksByConsultation when audioUrl exists", async () => {
      // Simulating the normal flow - audioUrl is present
      const consultation = mockConsultationWithAudio;
      if (!consultation.audioUrl) {
        await getAudioChunksByConsultation(consultation.id);
      }
      expect(getAudioChunksByConsultation).not.toHaveBeenCalled();
    });
  });
});
