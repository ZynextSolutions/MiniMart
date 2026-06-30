import { RateLimitError } from "@/lib/errors/app-error";
import { getClientIp } from "./client-ip";
import { checkMemoryRateLimit } from "./memory-limiter";
import { checkUpstashRateLimit } from "./upstash-limiter";
import type { RateLimitOptions, RateLimitResult } from "./types";

export type { RateLimitOptions, RateLimitResult };
export { getClientIp };

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const upstashResult = await checkUpstashRateLimit(options);
  if (upstashResult) return upstashResult;
  return checkMemoryRateLimit(options);
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const result = await rateLimit(options);
  if (!result.success) {
    throw new RateLimitError();
  }
  return result;
}

export async function enforceApiRateLimit(
  request: Request,
  namespace: string,
  limit = 120,
  windowMs = 60_000,
): Promise<RateLimitResult> {
  const ip = getClientIp(request);
  return enforceRateLimit({
    key: `api:${namespace}:${ip}`,
    limit,
    windowMs,
  });
}

export async function enforceLoginRateLimit(email: string, ip: string): Promise<void> {
  await enforceRateLimit({
    key: `login:ip:${ip}`,
    limit: 30,
    windowMs: 15 * 60_000,
  });

  await enforceRateLimit({
    key: `login:email:${email.toLowerCase()}`,
    limit: 10,
    windowMs: 15 * 60_000,
  });
}
