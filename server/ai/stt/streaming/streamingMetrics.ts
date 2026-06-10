/**
 * Streaming Metrics — Latency & Quality Tracking
 *
 * Tracks per-session metrics for streaming transcription:
 * - Latency (time between audio send and transcript receive)
 * - Quality (confidence scores, turn counts)
 * - Reliability (reconnections, errors, packet loss)
 *
 * Metrics are logged at session end and can be used for alerting.
 */
import { createLogger } from "../../../lib/logger";

const log = createLogger("stt:streaming:metrics");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface StreamingSessionMetrics {
  sessionId: string;
  consultationId: number;
  provider: string;
  model: string;

  // Timing
  sessionStartedAt: number;
  sessionEndedAt: number | null;
  sessionDurationMs: number;

  // Audio
  audioPacketsSent: number;
  audioBytesTotal: number;
  audioDurationEstimateMs: number;

  // Transcription
  partialEventsReceived: number;
  finalEventsReceived: number;
  totalWordsTranscribed: number;
  averageConfidence: number;

  // Latency
  latencyMeasurements: number[];
  averageLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;

  // Reliability
  reconnectionAttempts: number;
  reconnectionSuccesses: number;
  errorsReceived: number;
  lastError: string | null;
}

// --------------------------------------------------------------------------
// StreamingMetrics Class
// --------------------------------------------------------------------------

export class StreamingMetrics {
  private readonly sessionId: string;
  private readonly consultationId: number;
  private readonly provider: string;
  private readonly model: string;
  private readonly sessionStartedAt: number;
  private sessionEndedAt: number | null = null;

  // Audio tracking
  private audioPacketsSent = 0;
  private audioBytesTotal = 0;
  private readonly sampleRate: number;

  // Transcription tracking
  private partialEventsReceived = 0;
  private finalEventsReceived = 0;
  private totalWordsTranscribed = 0;
  private confidenceValues: number[] = [];

  // Latency tracking
  private latencyMeasurements: number[] = [];
  private lastAudioSentAt: number | null = null;

  // Reliability tracking
  private reconnectionAttempts = 0;
  private reconnectionSuccesses = 0;
  private errorsReceived = 0;
  private lastError: string | null = null;

  constructor(options: {
    sessionId: string;
    consultationId: number;
    provider: string;
    model: string;
    sampleRate?: number;
  }) {
    this.sessionId = options.sessionId;
    this.consultationId = options.consultationId;
    this.provider = options.provider;
    this.model = options.model;
    this.sampleRate = options.sampleRate || 16000;
    this.sessionStartedAt = Date.now();
  }

  // --------------------------------------------------------------------------
  // Recording Methods
  // --------------------------------------------------------------------------

  recordAudioPacket(bytes: number): void {
    this.audioPacketsSent += 1;
    this.audioBytesTotal += bytes;
    this.lastAudioSentAt = Date.now();
  }

  recordPartialEvent(text: string, confidence?: number | null): void {
    this.partialEventsReceived += 1;
    if (this.lastAudioSentAt) {
      const latency = Date.now() - this.lastAudioSentAt;
      this.latencyMeasurements.push(latency);
    }
    if (typeof confidence === "number") {
      this.confidenceValues.push(confidence);
    }
  }

  recordFinalEvent(text: string, confidence?: number | null): void {
    this.finalEventsReceived += 1;
    this.totalWordsTranscribed += text.split(/\s+/).filter(Boolean).length;
    if (this.lastAudioSentAt) {
      const latency = Date.now() - this.lastAudioSentAt;
      this.latencyMeasurements.push(latency);
    }
    if (typeof confidence === "number") {
      this.confidenceValues.push(confidence);
    }
  }

  recordReconnectionAttempt(): void {
    this.reconnectionAttempts += 1;
  }

  recordReconnectionSuccess(): void {
    this.reconnectionSuccesses += 1;
  }

  recordError(message: string): void {
    this.errorsReceived += 1;
    this.lastError = message;
  }

  // --------------------------------------------------------------------------
  // Computed Metrics
  // --------------------------------------------------------------------------

  private computeAverageLatency(): number {
    if (this.latencyMeasurements.length === 0) return 0;
    return Math.round(
      this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length
    );
  }

  private computeP95Latency(): number {
    if (this.latencyMeasurements.length === 0) return 0;
    const sorted = [...this.latencyMeasurements].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  private computeMaxLatency(): number {
    if (this.latencyMeasurements.length === 0) return 0;
    return Math.max(...this.latencyMeasurements);
  }

  private computeAverageConfidence(): number {
    if (this.confidenceValues.length === 0) return 0;
    return Number(
      (this.confidenceValues.reduce((a, b) => a + b, 0) / this.confidenceValues.length).toFixed(3)
    );
  }

  private computeAudioDurationMs(): number {
    // PCM16: 2 bytes per sample
    return Math.round((this.audioBytesTotal / (this.sampleRate * 2)) * 1000);
  }

  // --------------------------------------------------------------------------
  // Finalization
  // --------------------------------------------------------------------------

  /**
   * Finalize the session and return computed metrics.
   * Also logs a summary for observability.
   */
  finalize(): StreamingSessionMetrics {
    this.sessionEndedAt = Date.now();
    const sessionDurationMs = this.sessionEndedAt - this.sessionStartedAt;

    const metrics: StreamingSessionMetrics = {
      sessionId: this.sessionId,
      consultationId: this.consultationId,
      provider: this.provider,
      model: this.model,
      sessionStartedAt: this.sessionStartedAt,
      sessionEndedAt: this.sessionEndedAt,
      sessionDurationMs,
      audioPacketsSent: this.audioPacketsSent,
      audioBytesTotal: this.audioBytesTotal,
      audioDurationEstimateMs: this.computeAudioDurationMs(),
      partialEventsReceived: this.partialEventsReceived,
      finalEventsReceived: this.finalEventsReceived,
      totalWordsTranscribed: this.totalWordsTranscribed,
      averageConfidence: this.computeAverageConfidence(),
      latencyMeasurements: this.latencyMeasurements,
      averageLatencyMs: this.computeAverageLatency(),
      p95LatencyMs: this.computeP95Latency(),
      maxLatencyMs: this.computeMaxLatency(),
      reconnectionAttempts: this.reconnectionAttempts,
      reconnectionSuccesses: this.reconnectionSuccesses,
      errorsReceived: this.errorsReceived,
      lastError: this.lastError,
    };

    log.info("Streaming session metrics", {
      sessionId: this.sessionId,
      consultationId: this.consultationId,
      provider: this.provider,
      durationMs: sessionDurationMs,
      audioPackets: this.audioPacketsSent,
      audioDurationMs: metrics.audioDurationEstimateMs,
      finals: this.finalEventsReceived,
      words: this.totalWordsTranscribed,
      avgLatencyMs: metrics.averageLatencyMs,
      p95LatencyMs: metrics.p95LatencyMs,
      avgConfidence: metrics.averageConfidence,
      reconnections: `${this.reconnectionSuccesses}/${this.reconnectionAttempts}`,
      errors: this.errorsReceived,
    });

    return metrics;
  }
}
