/**
 * Circuit Breaker — Protects against cascading failures
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests are rejected immediately
 * - HALF_OPEN: After cooldown, allows one probe request to test recovery
 *
 * Usage:
 *   const breaker = new CircuitBreaker("llm", { failureThreshold: 5, cooldownMs: 30000 });
 *   const result = await breaker.execute(() => invokeLLM(params));
 */
import { createLogger } from "./logger";

const log = createLogger("circuit-breaker");

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold?: number;
  /** Time in ms to wait before allowing a probe request */
  cooldownMs?: number;
  /** Time window in ms to count failures (sliding window) */
  windowMs?: number;
  /** Optional callback when circuit opens */
  onOpen?: () => void;
  /** Optional callback when circuit closes */
  onClose?: () => void;
}

interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
  totalRequests: number;
  totalRejected: number;
}

// --------------------------------------------------------------------------
// CircuitBreaker Class
// --------------------------------------------------------------------------

export class CircuitBreaker {
  private readonly name: string;
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private openedAt: number | null = null;
  private totalRequests = 0;
  private totalRejected = 0;

  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly onOpen?: () => void;
  private readonly onClose?: () => void;

  constructor(name: string, options?: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options?.failureThreshold ?? 5;
    this.cooldownMs = options?.cooldownMs ?? 30000;
    this.onOpen = options?.onOpen;
    this.onClose = options?.onClose;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests += 1;

    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN";
        log.info("Circuit half-open, allowing probe", { name: this.name });
      } else {
        this.totalRejected += 1;
        throw new CircuitOpenError(this.name, this.cooldownMs);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if the circuit breaker is currently allowing requests.
   */
  isAvailable(): boolean {
    if (this.state === "CLOSED") return true;
    if (this.state === "HALF_OPEN") return true;
    return this.shouldAttemptReset();
  }

  /**
   * Get current stats for observability.
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      openedAt: this.openedAt,
      totalRequests: this.totalRequests,
      totalRejected: this.totalRejected,
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.openedAt = null;
    log.info("Circuit manually reset", { name: this.name });
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private onSuccess(): void {
    this.successes += 1;
    this.lastSuccessAt = Date.now();

    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      this.failures = 0;
      this.openedAt = null;
      log.info("Circuit closed after successful probe", { name: this.name });
      this.onClose?.();
    } else {
      // Reset failure count on success in CLOSED state
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures += 1;
    this.lastFailureAt = Date.now();

    if (this.state === "HALF_OPEN") {
      // Probe failed, go back to OPEN
      this.state = "OPEN";
      this.openedAt = Date.now();
      log.warn("Circuit re-opened after failed probe", { name: this.name, failures: this.failures });
      return;
    }

    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
      log.warn("Circuit opened", {
        name: this.name,
        failures: this.failures,
        threshold: this.failureThreshold,
      });
      this.onOpen?.();
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.openedAt) return false;
    return Date.now() - this.openedAt >= this.cooldownMs;
  }
}

// --------------------------------------------------------------------------
// Error Class
// --------------------------------------------------------------------------

export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly cooldownMs: number;

  constructor(circuitName: string, cooldownMs: number) {
    super(`Circuit breaker "${circuitName}" is OPEN. Retry after ${cooldownMs}ms cooldown.`);
    this.name = "CircuitOpenError";
    this.circuitName = circuitName;
    this.cooldownMs = cooldownMs;
  }
}

// --------------------------------------------------------------------------
// Singleton Instances
// --------------------------------------------------------------------------

/** Circuit breaker for LLM calls (Forge API) */
export const llmCircuitBreaker = new CircuitBreaker("llm", {
  failureThreshold: 5,
  cooldownMs: 30000, // 30 seconds
  onOpen: () => log.error("LLM circuit breaker OPENED — all AI calls will be rejected for 30s"),
  onClose: () => log.info("LLM circuit breaker CLOSED — AI calls resumed"),
});

/** Circuit breaker for STT batch calls */
export const sttCircuitBreaker = new CircuitBreaker("stt-batch", {
  failureThreshold: 3,
  cooldownMs: 60000, // 60 seconds
  onOpen: () => log.error("STT circuit breaker OPENED — batch transcription calls rejected for 60s"),
  onClose: () => log.info("STT circuit breaker CLOSED — batch transcription resumed"),
});

/** Circuit breaker for storage operations */
export const storageCircuitBreaker = new CircuitBreaker("storage", {
  failureThreshold: 3,
  cooldownMs: 15000, // 15 seconds
  onOpen: () => log.error("Storage circuit breaker OPENED — S3 operations rejected for 15s"),
  onClose: () => log.info("Storage circuit breaker CLOSED — S3 operations resumed"),
});
