import { RateLimitError } from "@/lib/errors/app-error";
import { getClientIp } from "./client-ip";
import { checkMemoryRateLimit } from "./memory-limiter";
import { checkPostgresRateLimit } from "./postgres-limiter";
import type { RateLimitOptions, RateLimitResult } from "./types";

export type { RateLimitOptions, RateLimitResult };
export { getClientIp };

function prefersMemoryStore(): boolean {
  return process.env.RATE_LIMIT_STORE === "memory";
}

export async function rateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  if (prefersMemoryStore()) {
    return checkMemoryRateLimit(options);
  }

  return checkPostgresRateLimit(options);
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
