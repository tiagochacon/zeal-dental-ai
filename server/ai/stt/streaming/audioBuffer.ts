/**
 * Audio Buffer — Reconnection Safety Net
 *
 * Buffers recent audio packets so that during a reconnection event,
 * the last N seconds of audio can be replayed to the new provider session.
 *
 * This prevents losing speech that was spoken during the brief disconnection window.
 */
import { createLogger } from "../../../lib/logger";

const log = createLogger("stt:streaming:buffer");

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

/** How many seconds of audio to keep in the ring buffer */
const DEFAULT_BUFFER_SECONDS = 10;

/** Default sample rate (16kHz PCM16 = 32000 bytes/sec) */
const DEFAULT_SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2; // PCM16

// --------------------------------------------------------------------------
// AudioBuffer Class
// --------------------------------------------------------------------------

export class AudioBuffer {
  private readonly maxBytes: number;
  private readonly chunks: Buffer[] = [];
  private totalBytes = 0;
  private readonly sampleRate: number;
  private packetCount = 0;
  private droppedBytes = 0;

  constructor(options?: { bufferSeconds?: number; sampleRate?: number }) {
    this.sampleRate = options?.sampleRate || DEFAULT_SAMPLE_RATE;
    const bufferSeconds = options?.bufferSeconds || DEFAULT_BUFFER_SECONDS;
    this.maxBytes = bufferSeconds * this.sampleRate * BYTES_PER_SAMPLE;
  }

  /**
   * Push a new audio chunk into the ring buffer.
   * Old chunks are evicted when the buffer exceeds maxBytes.
   */
  push(chunk: Buffer): void {
    this.packetCount += 1;
    this.chunks.push(chunk);
    this.totalBytes += chunk.length;

    // Evict oldest chunks to stay within budget
    while (this.totalBytes > this.maxBytes && this.chunks.length > 1) {
      const evicted = this.chunks.shift()!;
      this.totalBytes -= evicted.length;
      this.droppedBytes += evicted.length;
    }
  }

  /**
   * Get all buffered audio as a single concatenated Buffer.
   * Used during reconnection to replay recent audio.
   */
  drain(): Buffer {
    if (this.chunks.length === 0) return Buffer.alloc(0);
    const combined = Buffer.concat(this.chunks);
    log.info("Audio buffer drained for replay", {
      chunks: this.chunks.length,
      bytes: combined.length,
      durationMs: Math.round((combined.length / (this.sampleRate * BYTES_PER_SAMPLE)) * 1000),
    });
    return combined;
  }

  /**
   * Get the approximate duration of buffered audio in milliseconds.
   */
  get durationMs(): number {
    return Math.round((this.totalBytes / (this.sampleRate * BYTES_PER_SAMPLE)) * 1000);
  }

  /**
   * Get buffer statistics.
   */
  get stats() {
    return {
      packetCount: this.packetCount,
      totalBytes: this.totalBytes,
      chunksInBuffer: this.chunks.length,
      droppedBytes: this.droppedBytes,
      durationMs: this.durationMs,
      maxBytes: this.maxBytes,
      utilizationPercent: Math.round((this.totalBytes / this.maxBytes) * 100),
    };
  }

  /**
   * Clear the buffer (e.g., after successful reconnection replay).
   */
  clear(): void {
    this.chunks.length = 0;
    this.totalBytes = 0;
  }

  /**
   * Reset all state including counters.
   */
  reset(): void {
    this.clear();
    this.packetCount = 0;
    this.droppedBytes = 0;
  }
}
