import { RateLimitError } from "@/lib/errors/app-error";
import type { RateLimitOptions, RateLimitResult } from "./types";

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export async function checkUpstashRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const config = getUpstashConfig();
  if (!config) {
    throw new RateLimitError("Rate limiter unavailable");
  }

  const windowSec = Math.max(1, Math.ceil(options.windowMs / 1000));
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", options.key],
      ["TTL", options.key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new RateLimitError("Rate limiter unavailable");
  }

  const results = (await response.json()) as { result: number }[];
  const count = results[0]?.result ?? 1;
  const ttl = results[1]?.result ?? -1;

  if (count === 1) {
    await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["EXPIRE", options.key, windowSec]]),
      cache: "no-store",
    });
  }

  const resetAt =
    ttl > 0 ? Date.now() + ttl * 1000 : Date.now() + options.windowMs;

  return {
    success: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    resetAt,
  };
}
