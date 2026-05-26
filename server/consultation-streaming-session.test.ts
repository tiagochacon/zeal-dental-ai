import { beforeEach, describe, expect, it, vi } from "vitest";

const providerStart = vi.fn(async () => undefined);

vi.mock("./_core/env", () => ({
  ENV: {
    consultationStreamingAssemblyAIModel: "universal-streaming-multilingual",
    consultationStreamingSampleRate: 16000,
    consultationStreamingTokenExpiresSeconds: 600,
    consultationStreamingMaxSessionSeconds: 3600,
    isProduction: false,
  },
}));

vi.mock("./helpers/consultationStreamingAvailability", () => ({
  getConsultationStreamingStatus: () => ({
    enabled: true,
    ready: true,
    provider: "assemblyai",
    reason: null,
  }),
}));

vi.mock("./ai/stt/streaming/providers/assemblyAIStreamingProvider", () => ({
  AssemblyAIStreamingProvider: class MockAssemblyAIStreamingProvider {
    public readonly provider = "assemblyai" as const;
    public readonly model = "universal-streaming-multilingual";

    constructor(_callbacks: unknown, _options?: unknown) {}

    start = providerStart;
    sendAudioPcm = vi.fn();
    stop = vi.fn();
    close = vi.fn();
  },
}));

import { ConsultationStreamingSession } from "./ai/stt/streaming/consultationStreamingSession";

describe("ConsultationStreamingSession.start", () => {
  beforeEach(() => {
    providerStart.mockClear();
  });

  it("emits session_started only after provider start succeeds", async () => {
    const events: Array<{ type: string }> = [];
    const session = new ConsultationStreamingSession({
      consultationId: 42,
      provider: "assemblyai",
      sendToClient: (event) => events.push(event),
    });

    await session.start();

    expect(providerStart).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "session_started")).toBe(true);
    expect(events[0]?.type).toBe("session_started");
  });

  it("does not emit session_started when provider start fails", async () => {
    providerStart.mockRejectedValueOnce(new Error("token failed"));

    const events: Array<{ type: string }> = [];
    const session = new ConsultationStreamingSession({
      consultationId: 42,
      provider: "assemblyai",
      sendToClient: (event) => events.push(event),
    });

    await expect(session.start()).rejects.toThrow("token failed");
    expect(events.some((event) => event.type === "session_started")).toBe(false);
  });
});
