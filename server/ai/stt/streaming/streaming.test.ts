/**
 * Streaming STT Tests — AudioBuffer, Metrics, Provider Chain
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioBuffer } from "./audioBuffer";
import { StreamingMetrics } from "./streamingMetrics";
import { resolveStreamingProvider, isStreamingAvailable } from "./streamingProviderChain";

// --------------------------------------------------------------------------
// AudioBuffer Tests
// --------------------------------------------------------------------------

describe("AudioBuffer", () => {
  it("should store and drain audio chunks", () => {
    const buffer = new AudioBuffer({ bufferSeconds: 5, sampleRate: 16000 });
    const chunk1 = Buffer.alloc(1000, 0x01);
    const chunk2 = Buffer.alloc(2000, 0x02);

    buffer.push(chunk1);
    buffer.push(chunk2);

    const drained = buffer.drain();
    expect(drained.length).toBe(3000);
    expect(drained.subarray(0, 1000)).toEqual(chunk1);
    expect(drained.subarray(1000, 3000)).toEqual(chunk2);
  });

  it("should evict old chunks when buffer exceeds maxBytes", () => {
    // 1 second buffer at 16kHz PCM16 = 32000 bytes
    const buffer = new AudioBuffer({ bufferSeconds: 1, sampleRate: 16000 });

    // Push 40000 bytes (exceeds 32000 max)
    const chunk1 = Buffer.alloc(20000, 0x01);
    const chunk2 = Buffer.alloc(20000, 0x02);

    buffer.push(chunk1);
    buffer.push(chunk2);

    // Should have evicted chunk1
    const drained = buffer.drain();
    expect(drained.length).toBeLessThanOrEqual(32000);
  });

  it("should report correct duration", () => {
    const buffer = new AudioBuffer({ bufferSeconds: 10, sampleRate: 16000 });
    // 1 second of audio at 16kHz PCM16 = 32000 bytes
    const oneSecond = Buffer.alloc(32000);
    buffer.push(oneSecond);

    expect(buffer.durationMs).toBe(1000);
  });

  it("should report correct stats", () => {
    const buffer = new AudioBuffer({ bufferSeconds: 10, sampleRate: 16000 });
    buffer.push(Buffer.alloc(1000));
    buffer.push(Buffer.alloc(2000));

    const stats = buffer.stats;
    expect(stats.packetCount).toBe(2);
    expect(stats.totalBytes).toBe(3000);
    expect(stats.chunksInBuffer).toBe(2);
  });

  it("should clear buffer", () => {
    const buffer = new AudioBuffer({ bufferSeconds: 10, sampleRate: 16000 });
    buffer.push(Buffer.alloc(1000));
    buffer.clear();

    expect(buffer.drain().length).toBe(0);
    expect(buffer.stats.totalBytes).toBe(0);
  });

  it("should handle empty drain", () => {
    const buffer = new AudioBuffer();
    const drained = buffer.drain();
    expect(drained.length).toBe(0);
  });
});

// --------------------------------------------------------------------------
// StreamingMetrics Tests
// --------------------------------------------------------------------------

describe("StreamingMetrics", () => {
  it("should track audio packets", () => {
    const metrics = new StreamingMetrics({
      sessionId: "test-1",
      consultationId: 1,
      provider: "assemblyai",
      model: "u3-rt-pro",
    });

    metrics.recordAudioPacket(1024);
    metrics.recordAudioPacket(1024);
    metrics.recordAudioPacket(1024);

    const result = metrics.finalize();
    expect(result.audioPacketsSent).toBe(3);
    expect(result.audioBytesTotal).toBe(3072);
  });

  it("should track transcription events", () => {
    const metrics = new StreamingMetrics({
      sessionId: "test-2",
      consultationId: 1,
      provider: "assemblyai",
      model: "u3-rt-pro",
    });

    metrics.recordAudioPacket(1024);
    metrics.recordPartialEvent("Olá", 0.8);
    metrics.recordFinalEvent("Olá, tudo bem?", 0.95);

    const result = metrics.finalize();
    expect(result.partialEventsReceived).toBe(1);
    expect(result.finalEventsReceived).toBe(1);
    expect(result.totalWordsTranscribed).toBe(3); // "Olá," "tudo" "bem?"
    expect(result.averageConfidence).toBeCloseTo(0.875, 2);
  });

  it("should compute latency metrics", () => {
    const metrics = new StreamingMetrics({
      sessionId: "test-3",
      consultationId: 1,
      provider: "assemblyai",
      model: "u3-rt-pro",
    });

    // Simulate audio send then transcript receive
    metrics.recordAudioPacket(1024);
    // Small delay simulation (in real usage, time passes between recordAudioPacket and recordPartialEvent)
    metrics.recordPartialEvent("test", 0.9);

    const result = metrics.finalize();
    expect(result.latencyMeasurements.length).toBe(1);
    expect(result.averageLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.p95LatencyMs).toBeGreaterThanOrEqual(0);
  });

  it("should track reconnection attempts", () => {
    const metrics = new StreamingMetrics({
      sessionId: "test-4",
      consultationId: 1,
      provider: "assemblyai",
      model: "u3-rt-pro",
    });

    metrics.recordReconnectionAttempt();
    metrics.recordReconnectionAttempt();
    metrics.recordReconnectionSuccess();

    const result = metrics.finalize();
    expect(result.reconnectionAttempts).toBe(2);
    expect(result.reconnectionSuccesses).toBe(1);
  });

  it("should track errors", () => {
    const metrics = new StreamingMetrics({
      sessionId: "test-5",
      consultationId: 1,
      provider: "assemblyai",
      model: "u3-rt-pro",
    });

    metrics.recordError("Connection timeout");
    metrics.recordError("Rate limit exceeded");

    const result = metrics.finalize();
    expect(result.errorsReceived).toBe(2);
    expect(result.lastError).toBe("Rate limit exceeded");
  });

  it("should compute session duration", () => {
    const metrics = new StreamingMetrics({
      sessionId: "test-6",
      consultationId: 1,
      provider: "assemblyai",
      model: "u3-rt-pro",
    });

    const result = metrics.finalize();
    expect(result.sessionDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.sessionEndedAt).not.toBeNull();
  });
});

// --------------------------------------------------------------------------
// StreamingProviderChain Tests
// --------------------------------------------------------------------------

describe("StreamingProviderChain", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("should resolve assemblyai when API key is present", () => {
    process.env.ASSEMBLYAI_API_KEY = "test-key-123";
    const result = resolveStreamingProvider();
    expect(result.provider).toBe("assemblyai");
    expect(result.fallbackUsed).toBe(false);
  });

  it("should return null when no providers are available", () => {
    delete process.env.ASSEMBLYAI_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    const result = resolveStreamingProvider();
    expect(result.provider).toBeNull();
  });

  it("should report availability status for all providers", () => {
    process.env.ASSEMBLYAI_API_KEY = "test-key";
    const result = resolveStreamingProvider();
    expect(result.availableProviders.length).toBeGreaterThan(0);
    const assemblyai = result.availableProviders.find((p) => p.provider === "assemblyai");
    expect(assemblyai?.available).toBe(true);
  });

  it("isStreamingAvailable should return true when a provider is available", () => {
    process.env.ASSEMBLYAI_API_KEY = "test-key";
    expect(isStreamingAvailable()).toBe(true);
  });

  it("isStreamingAvailable should return false when no provider is available", () => {
    delete process.env.ASSEMBLYAI_API_KEY;
    delete process.env.DEEPGRAM_API_KEY;
    expect(isStreamingAvailable()).toBe(false);
  });
});
