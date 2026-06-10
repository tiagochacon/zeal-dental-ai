/**
 * Tests for Circuit Breaker and Rate Limiter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "./circuitBreaker";
import { RateLimiter } from "./rateLimiter";

// --------------------------------------------------------------------------
// Circuit Breaker Tests
// --------------------------------------------------------------------------

describe("CircuitBreaker", () => {
  it("should allow requests when CLOSED", async () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 3 });
    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("should open after reaching failure threshold", async () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 3, cooldownMs: 10000 });

    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow("fail");
    }

    // Next request should be rejected with CircuitOpenError
    await expect(breaker.execute(() => Promise.resolve("ok"))).rejects.toThrow(CircuitOpenError);
    expect(breaker.getStats().state).toBe("OPEN");
  });

  it("should transition to HALF_OPEN after cooldown", async () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker("test", { failureThreshold: 2, cooldownMs: 1000 });

    // Open the circuit
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(breaker.getStats().state).toBe("OPEN");

    // Advance past cooldown
    vi.advanceTimersByTime(1100);

    // Should allow a probe request
    const result = await breaker.execute(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
    expect(breaker.getStats().state).toBe("CLOSED");

    vi.useRealTimers();
  });

  it("should re-open if probe fails", async () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker("test", { failureThreshold: 2, cooldownMs: 1000 });

    // Open the circuit
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    // Advance past cooldown
    vi.advanceTimersByTime(1100);

    // Probe fails
    await expect(breaker.execute(() => Promise.reject(new Error("still broken")))).rejects.toThrow();
    expect(breaker.getStats().state).toBe("OPEN");

    vi.useRealTimers();
  });

  it("should reset failure count on success", async () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 3 });

    // 2 failures
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    // 1 success resets count
    await breaker.execute(() => Promise.resolve("ok"));

    // 2 more failures should not open (count reset)
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(breaker.getStats().state).toBe("CLOSED");
  });

  it("should track stats correctly", async () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 5 });

    await breaker.execute(() => Promise.resolve("ok"));
    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();

    const stats = breaker.getStats();
    expect(stats.name).toBe("test");
    expect(stats.totalRequests).toBe(2);
    expect(stats.successes).toBe(1);
    expect(stats.failures).toBe(1);
  });

  it("should support manual reset", async () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 1, cooldownMs: 999999 });

    await expect(breaker.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow();
    expect(breaker.getStats().state).toBe("OPEN");

    breaker.reset();
    expect(breaker.getStats().state).toBe("CLOSED");

    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });
});

// --------------------------------------------------------------------------
// Rate Limiter Tests
// --------------------------------------------------------------------------

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("should allow requests within limit", () => {
    limiter = new RateLimiter({ name: "test", maxTokens: 5, refillRate: 1 });

    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(true);
  });

  it("should reject requests when tokens exhausted", () => {
    limiter = new RateLimiter({ name: "test", maxTokens: 2, refillRate: 0 });

    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(false); // exhausted
  });

  it("should refill tokens over time", () => {
    vi.useFakeTimers();
    limiter = new RateLimiter({ name: "test", maxTokens: 2, refillRate: 1 });

    // Exhaust tokens
    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(false);

    // Advance 2 seconds (refill 2 tokens)
    vi.advanceTimersByTime(2000);

    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(false);

    vi.useRealTimers();
  });

  it("should isolate buckets per key", () => {
    limiter = new RateLimiter({ name: "test", maxTokens: 1, refillRate: 0 });

    expect(limiter.consume("user1")).toBe(true);
    expect(limiter.consume("user1")).toBe(false);

    // Different user should have their own bucket
    expect(limiter.consume("user2")).toBe(true);
    expect(limiter.consume("user2")).toBe(false);
  });

  it("should report remaining tokens", () => {
    limiter = new RateLimiter({ name: "test", maxTokens: 5, refillRate: 0 });

    expect(limiter.remaining("user1")).toBe(5);
    limiter.consume("user1");
    expect(limiter.remaining("user1")).toBe(4);
  });

  it("should not exceed maxTokens on refill", () => {
    vi.useFakeTimers();
    limiter = new RateLimiter({ name: "test", maxTokens: 5, refillRate: 10 });

    // Advance a lot of time
    vi.advanceTimersByTime(100000);

    // Should still be capped at maxTokens
    expect(limiter.remaining("user1")).toBe(5);

    vi.useRealTimers();
  });

  it("should track stats", () => {
    limiter = new RateLimiter({ name: "test-stats", maxTokens: 2, refillRate: 0 });

    limiter.consume("user1");
    limiter.consume("user1");
    limiter.consume("user1"); // rejected

    const stats = limiter.getStats();
    expect(stats.name).toBe("test-stats");
    expect(stats.totalConsumed).toBe(2);
    expect(stats.totalRejected).toBe(1);
    expect(stats.activeBuckets).toBe(1);
  });

  it("should support consuming multiple tokens at once", () => {
    limiter = new RateLimiter({ name: "test", maxTokens: 10, refillRate: 0 });

    expect(limiter.consume("user1", 5)).toBe(true);
    expect(limiter.consume("user1", 5)).toBe(true);
    expect(limiter.consume("user1", 1)).toBe(false);
  });
});
