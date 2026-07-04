import { RateLimitError } from "@/lib/errors/app-error";
import { getClientIp } from "./client-ip";
import { checkMemoryRateLimit } from "./memory-limiter";
import { checkUpstashRateLimit } from "./upstash-limiter";
import type { RateLimitOptions, RateLimitResult } from "./types";

export type { RateLimitOptions, RateLimitResult };
export { getClientIp };

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function assertProductionRateLimiter(): void {
  if (isProduction() && !isUpstashConfigured()) {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set; " +
        "using in-memory rate limiting (fine for single-instance dev; configure Upstash for production).",
    );
  }
}

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  assertProductionRateLimiter();

  if (isUpstashConfigured()) {
    return checkUpstashRateLimit(options);
  }

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

export async function enforceSignupRateLimit(ip: string): Promise<void> {
  await enforceRateLimit({
    key: `signup:ip:${ip}`,
    limit: 5,
    windowMs: 60 * 60_000,
  });
}

export async function enforceInviteRateLimit(ip: string): Promise<void> {
  await enforceRateLimit({
    key: `invite:ip:${ip}`,
    limit: 30,
    windowMs: 15 * 60_000,
  });
}
