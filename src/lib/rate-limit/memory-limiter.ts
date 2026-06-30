import type { RateLimitOptions, RateLimitResult } from "./types";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkMemoryRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(options.key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(options.key, { count: 1, resetAt });
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt,
    };
  }

  existing.count += 1;
  buckets.set(options.key, existing);

  return {
    success: existing.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function resetMemoryRateLimitStore() {
  buckets.clear();
}
