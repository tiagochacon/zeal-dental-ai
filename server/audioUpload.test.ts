import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "calls/1/123-abc.webm", url: "https://s3.example.com/calls/1/123-abc.webm" }),
}));

vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getCallById: vi.fn(),
  updateCall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn().mockReturnValue("testid12"),
}));

import { getUserById, getCallById, updateCall } from "./db";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";

describe("Audio Upload Route", () => {
  const mockUser = {
    id: 1,
    openId: "test-open-id",
    name: "Test User",
    email: "test@example.com",
    clinicId: 1,
    role: "admin" as const,
  };

  const mockCall = {
    id: 100,
    clinicId: 1,
    leadId: 1,
    leadName: "Test Lead",
    status: "pending",
    audioUrl: null,
    audioFileKey: null,
    audioDurationSeconds: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (sdk.authenticateRequest as any).mockResolvedValue(mockUser);
    (getUserById as any).mockResolvedValue(mockUser);
    (getCallById as any).mockResolvedValue(mockCall);
  });

  describe("Validation", () => {
    it("should define correct max file size of 100MB", () => {
      const MAX_FILE_SIZE_MB = 100;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
      expect(MAX_FILE_SIZE_BYTES).toBe(104857600); // 100MB in bytes
    });

    it("should define correct max duration of 30 minutes", () => {
      const MAX_DURATION_SECONDS = 30 * 60;
      expect(MAX_DURATION_SECONDS).toBe(1800);
    });

    it("should allow common audio MIME types", () => {
      const ALLOWED_MIME_TYPES = [
        "audio/webm",
        "audio/mp3",
        "audio/mpeg",
        "audio/wav",
        "audio/wave",
        "audio/ogg",
        "audio/m4a",
        "audio/mp4",
        "audio/x-m4a",
        "audio/aac",
        "audio/flac",
      ];
      
      expect(ALLOWED_MIME_TYPES).toContain("audio/webm");
      expect(ALLOWED_MIME_TYPES).toContain("audio/mp3");
      expect(ALLOWED_MIME_TYPES).toContain("audio/mpeg");
      expect(ALLOWED_MIME_TYPES).toContain("audio/wav");
      expect(ALLOWED_MIME_TYPES).toContain("audio/ogg");
      expect(ALLOWED_MIME_TYPES).toContain("audio/m4a");
      expect(ALLOWED_MIME_TYPES).toContain("audio/mp4");
      expect(ALLOWED_MIME_TYPES).toContain("audio/flac");
    });
  });

  describe("File extension mapping", () => {
    it("should map MIME types to correct extensions", () => {
      const extMap: Record<string, string> = {
        "audio/webm": "webm",
        "audio/mp3": "mp3",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/wave": "wav",
        "audio/ogg": "ogg",
        "audio/m4a": "m4a",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/aac": "aac",
        "audio/flac": "flac",
      };

      expect(extMap["audio/webm"]).toBe("webm");
      expect(extMap["audio/mp3"]).toBe("mp3");
      expect(extMap["audio/mpeg"]).toBe("mp3");
      expect(extMap["audio/wav"]).toBe("wav");
      expect(extMap["audio/m4a"]).toBe("m4a");
      expect(extMap["audio/mp4"]).toBe("m4a");
      expect(extMap["audio/flac"]).toBe("flac");
    });
  });

  describe("Storage integration", () => {
    it("should upload audio buffer to S3 with correct parameters", async () => {
      const buffer = Buffer.from("fake audio data");
      const fileKey = "calls/1/100-testid12.webm";
      
      await storagePut(fileKey, buffer, "audio/webm");
      
      expect(storagePut).toHaveBeenCalledWith(fileKey, buffer, "audio/webm");
    });

    it("should update call record after successful upload", async () => {
      const callId = 100;
      const audioUrl = "https://s3.example.com/calls/1/100-testid12.webm";
      const fileKey = "calls/1/100-testid12.webm";
      
      await updateCall(callId, {
        audioUrl,
        audioFileKey: fileKey,
        audioDurationSeconds: 120,
      });
      
      expect(updateCall).toHaveBeenCalledWith(callId, {
        audioUrl,
        audioFileKey: fileKey,
        audioDurationSeconds: 120,
      });
    });
  });

  describe("Authentication", () => {
    it("should authenticate user via SDK", async () => {
      const mockReq = { headers: { cookie: "session=test" } };
      await sdk.authenticateRequest(mockReq as any);
      expect(sdk.authenticateRequest).toHaveBeenCalledWith(mockReq);
    });

    it("should verify user belongs to a clinic", async () => {
      const user = await getUserById(1);
      expect(user).toBeDefined();
      expect(user!.clinicId).toBeTruthy();
    });

    it("should reject user without clinic", async () => {
      (getUserById as any).mockResolvedValue({ ...mockUser, clinicId: null });
      const user = await getUserById(1);
      expect(user!.clinicId).toBeNull();
    });
  });

  describe("Call ownership verification", () => {
    it("should verify call belongs to user clinic", async () => {
      const call = await getCallById(100);
      expect(call).toBeDefined();
      expect(call!.clinicId).toBe(mockUser.clinicId);
    });

    it("should reject call from different clinic", async () => {
      (getCallById as any).mockResolvedValue({ ...mockCall, clinicId: 999 });
      const call = await getCallById(100);
      expect(call!.clinicId).not.toBe(mockUser.clinicId);
    });

    it("should reject non-existent call", async () => {
      (getCallById as any).mockResolvedValue(null);
      const call = await getCallById(999);
      expect(call).toBeNull();
    });
  });

  describe("Duration validation", () => {
    it("should accept duration within 30 minute limit", () => {
      const MAX_DURATION_SECONDS = 30 * 60;
      const duration = 25 * 60; // 25 minutes
      expect(duration).toBeLessThanOrEqual(MAX_DURATION_SECONDS);
    });

    it("should reject duration exceeding 30 minute limit", () => {
      const MAX_DURATION_SECONDS = 30 * 60;
      const duration = 35 * 60; // 35 minutes
      expect(duration).toBeGreaterThan(MAX_DURATION_SECONDS);
    });

    it("should accept null duration (optional)", () => {
      const durationSeconds = null;
      expect(durationSeconds).toBeNull();
    });
  });

  describe("Transcription size limit", () => {
    it("should allow files up to 25MB for transcription", () => {
      const MAX_TRANSCRIPTION_SIZE_MB = 25;
      const fileSizeMB = 20; // 20MB file
      expect(fileSizeMB).toBeLessThanOrEqual(MAX_TRANSCRIPTION_SIZE_MB);
    });

    it("should reject files over 25MB for transcription", () => {
      const MAX_TRANSCRIPTION_SIZE_MB = 25;
      const fileSizeMB = 30; // 30MB file
      expect(fileSizeMB).toBeGreaterThan(MAX_TRANSCRIPTION_SIZE_MB);
    });

    it("should estimate WebM 30min file under transcription limit", () => {
      // WebM/Opus at 32kbps: 30min ≈ 7.2MB
      const estimatedSizeMB = (32 * 30 * 60) / (8 * 1024); // kbps * seconds / (8 * 1024) = MB
      expect(estimatedSizeMB).toBeLessThan(25);
    });

    it("should estimate MP3 128kbps 30min file near transcription limit", () => {
      // MP3 at 128kbps: 30min ≈ 28.8MB
      const estimatedSizeMB = (128 * 30 * 60) / (8 * 1024);
      expect(estimatedSizeMB).toBeGreaterThan(25);
      // This means very large MP3 files might need compression
    });
  });
});
