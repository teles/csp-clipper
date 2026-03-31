import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../src/rate-limiter";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 10_000);
  });

  it("should allow requests within the limit", () => {
    const result = limiter.isAllowed("ip1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("should decrement remaining on each request", () => {
    limiter.isAllowed("ip1");
    const result = limiter.isAllowed("ip1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("should block after exceeding the limit", () => {
    limiter.isAllowed("ip1");
    limiter.isAllowed("ip1");
    limiter.isAllowed("ip1");
    const result = limiter.isAllowed("ip1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track different keys independently", () => {
    limiter.isAllowed("ip1");
    limiter.isAllowed("ip1");
    limiter.isAllowed("ip1");

    const result = limiter.isAllowed("ip2");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("should reset after the time window", () => {
    const now = 1000;
    limiter.isAllowed("ip1", now);
    limiter.isAllowed("ip1", now + 1000);
    limiter.isAllowed("ip1", now + 2000);

    const blocked = limiter.isAllowed("ip1", now + 3000);
    expect(blocked.allowed).toBe(false);

    const afterReset = limiter.isAllowed("ip1", now + 11_000);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(2);
  });

  it("should clean up expired entries", () => {
    const now = 1000;
    limiter.isAllowed("ip1", now);
    limiter.isAllowed("ip2", now);
    expect(limiter.size).toBe(2);

    limiter.isAllowed("ip3", now + 15_000);
    expect(limiter.size).toBe(1);
  });

  it("should return resetAt timestamp", () => {
    const now = 5000;
    const result = limiter.isAllowed("ip1", now);
    expect(result.resetAt).toBe(now + 10_000);
  });

  it("should use default parameters", () => {
    const defaultLimiter = new RateLimiter();
    const result = defaultLimiter.isAllowed("ip1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
  });
});
