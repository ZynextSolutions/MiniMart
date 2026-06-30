import { afterEach, describe, expect, it } from "vitest";
import {
  checkMemoryRateLimit,
  resetMemoryRateLimitStore,
} from "@/lib/rate-limit/memory-limiter";

describe("memory rate limiter", () => {
  afterEach(() => {
    resetMemoryRateLimitStore();
  });

  it("allows requests under the limit", () => {
    const options = { key: "test-key", limit: 3, windowMs: 60_000 };

    expect(checkMemoryRateLimit(options).success).toBe(true);
    expect(checkMemoryRateLimit(options).success).toBe(true);
    expect(checkMemoryRateLimit(options).success).toBe(true);
  });

  it("blocks requests over the limit", () => {
    const options = { key: "test-key", limit: 2, windowMs: 60_000 };

    checkMemoryRateLimit(options);
    checkMemoryRateLimit(options);
    const blocked = checkMemoryRateLimit(options);

    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
