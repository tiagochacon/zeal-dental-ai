import { afterEach, describe, expect, it } from "vitest";
import { getConsultationStreamingStatus } from "./helpers/consultationStreamingAvailability";

describe("getConsultationStreamingStatus", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns not ready when AssemblyAI key is missing", () => {
    process.env.CONSULTATION_STREAMING_ASR_ENABLED = "true";
    process.env.CONSULTATION_STREAMING_ASR_PROVIDER = "assemblyai";
    delete process.env.ASSEMBLYAI_API_KEY;

    const status = getConsultationStreamingStatus();
    expect(status.enabled).toBe(true);
    expect(status.ready).toBe(false);
    expect(status.provider).toBe("assemblyai");
    expect(status.reason).toContain("ASSEMBLYAI_API_KEY");
  });

  it("returns ready when AssemblyAI key is configured", () => {
    process.env.CONSULTATION_STREAMING_ASR_ENABLED = "true";
    process.env.CONSULTATION_STREAMING_ASR_PROVIDER = "assemblyai";
    process.env.ASSEMBLYAI_API_KEY = "test-key";

    const status = getConsultationStreamingStatus();
    expect(status.ready).toBe(true);
    expect(status.reason).toBeNull();
  });

  it("returns disabled when feature flag is off", () => {
    process.env.CONSULTATION_STREAMING_ASR_ENABLED = "false";
    process.env.ASSEMBLYAI_API_KEY = "test-key";

    const status = getConsultationStreamingStatus();
    expect(status.enabled).toBe(false);
    expect(status.ready).toBe(false);
  });
});
