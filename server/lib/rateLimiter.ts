/**
 * Rate Limiter — Token Bucket Algorithm
 *
 * Protects expensive endpoints (AI, STT) from abuse.
 * Uses in-memory token bucket per user/IP with configurable rates.
 *
 * Usage:
 *   const limiter = new RateLimiter({ maxTokens: 10, refillRate: 1 });
 *   if (!limiter.consume(userId)) throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
 */
import { createLogger } from "./logger";

const log = createLogger("rate-limiter");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface RateLimiterOptions {
  /** Maximum tokens in the bucket */
  maxTokens: number;
  /** Tokens added per second */
  refillRate: number;
  /** Name for logging */
  name?: string;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterStats {
  name: string;
  activeBuckets: number;
  totalConsumed: number;
  totalRejected: number;
}

// --------------------------------------------------------------------------
// RateLimiter Class
// --------------------------------------------------------------------------

export class RateLimiter {
  private readonly name: string;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly buckets = new Map<string, Bucket>();
  private totalConsumed = 0;
  private totalRejected = 0;

  // Cleanup interval to prevent memory leaks
  private readonly cleanupInterval: ReturnType<typeof setInterval>;
  private static readonly BUCKET_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(options: RateLimiterOptions) {
    this.name = options.name || "default";
    this.maxTokens = options.maxTokens;
    this.refillRate = options.refillRate;

    // Periodically clean up stale buckets
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    // Prevent the interval from keeping the process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Try to consume a token for the given key (userId, IP, etc.).
   * Returns true if allowed, false if rate limited.
   */
  consume(key: string, tokens = 1): boolean {
    const bucket = this.getOrCreateBucket(key);
    this.refill(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      this.totalConsumed += tokens;
      return true;
    }

    this.totalRejected += 1;
    log.warn("Rate limit exceeded", { limiter: this.name, key, tokens: bucket.tokens });
    return false;
  }

  /**
   * Check remaining tokens without consuming.
   */
  remaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxTokens;
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Get stats for observability.
   */
  getStats(): RateLimiterStats {
    return {
      name: this.name,
      activeBuckets: this.buckets.size,
      totalConsumed: this.totalConsumed,
      totalRejected: this.totalRejected,
    };
  }

  /**
   * Destroy the rate limiter and clean up resources.
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private getOrCreateBucket(key: string): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: Date.now() };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refill(bucket: Bucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    const keys = Array.from(this.buckets.keys());
    for (const key of keys) {
      const bucket = this.buckets.get(key);
      if (bucket && now - bucket.lastRefill > RateLimiter.BUCKET_TTL_MS) {
        this.buckets.delete(key);
        cleaned += 1;
      }
    }
    if (cleaned > 0) {
      log.info("Rate limiter cleanup", { limiter: this.name, cleaned, remaining: this.buckets.size });
    }
  }
}

// --------------------------------------------------------------------------
// Singleton Instances
// --------------------------------------------------------------------------

/** Rate limiter for AI/LLM endpoints (SOAP, neurovendas, etc.) */
export const aiRateLimiter = new RateLimiter({
  name: "ai-endpoints",
  maxTokens: 10,    // 10 requests burst
  refillRate: 0.5,  // 1 token every 2 seconds (30/min sustained)
});

/** Rate limiter for STT batch transcription */
export const sttRateLimiter = new RateLimiter({
  name: "stt-batch",
  maxTokens: 5,     // 5 requests burst
  refillRate: 0.2,  // 1 token every 5 seconds (12/min sustained)
});

/** Rate limiter for streaming sessions */
export const streamingRateLimiter = new RateLimiter({
  name: "streaming",
  maxTokens: 3,     // 3 concurrent sessions max
  refillRate: 0.1,  // 1 token every 10 seconds
});
